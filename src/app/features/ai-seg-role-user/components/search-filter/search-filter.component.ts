import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { PersonalInfoListado } from '@features/ai-seg-role-user/models/user';
import { FilterStateService } from '@core/services/filter-state.service';
import { debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-search-filter',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './search-filter.component.html',
  styleUrl: './search-filter.component.css',
})
export class SearchFilterComponent implements OnChanges, OnInit {
  @Input() users: PersonalInfoListado[] = [];
  @Output() filterChanged = new EventEmitter<{
    departamento: string;
    search: string;
  }>();

  protected departamentos: string[] = [];
  protected departamentoControl = new FormControl('');
  protected filteredItems: { cargo: string; nombre: string }[] = [];
  protected searchControl = new FormControl({ value: '', disabled: true });
  showDropdown = false;
  private readonly filterStateService = inject(FilterStateService);

  ngOnChanges(changes: SimpleChanges) {
    if (changes['users'] && changes['users'].currentValue) {
      this.initializeDepartamentos();
      
      // Si hay datos cargados, intentar restaurar filtros de nuevo para asegurar
      const saved = this.filterStateService.getFilters('seg_role_user');
      if (saved && saved.departamento) {
        this.departamentoControl.setValue(saved.departamento, { emitEvent: false });
        this.searchControl.enable();
        this.searchControl.setValue(saved.search, { emitEvent: false });
        this.filterItems(saved.search);
      }
    }
  }

  ngOnInit() {
    const saved = this.filterStateService.getFilters('seg_role_user');
    if (saved) {
      this.departamentoControl.setValue(saved.departamento, { emitEvent: false });
      if (saved.departamento) {
        this.searchControl.enable();
        this.searchControl.setValue(saved.search, { emitEvent: false });
        this.filterItems(saved.search);
      }
      setTimeout(() => {
        this.emitFilterChange();
      });
    }

    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(value => {
      // Verificar si el campo de búsqueda está vacío
      if (value === '') {
        // Si está vacío, emitir un filtro solo por departamento
        this.emitFilterChange();
      } else {
        // Aplicar el filtro normalmente
        this.filterItems(value);
      }
      this.filterStateService.setFilters('seg_role_user', {
        departamento: this.departamentoControl.value || '',
        search: value || ''
      });
    });

    this.departamentoControl.valueChanges.subscribe((value) => {
      this.onDepartamentoChange();
      this.filterStateService.setFilters('seg_role_user', {
        departamento: value || '',
        search: this.searchControl.value || ''
      });
    });
  }

  clearFilters(): void {
    this.departamentoControl.setValue('', { emitEvent: false });
    this.searchControl.setValue('', { emitEvent: false });
    this.searchControl.disable();
    this.filteredItems = [];
    this.filterStateService.clearFilters('seg_role_user');
    this.emitFilterChange();
  }

  private initializeDepartamentos() {
    this.departamentos = [
      ...new Set(this.users.map((user) => user.DEPARTAMENTO)),
    ];
  }

  protected onDepartamentoChange() {
    if (this.departamentoControl.value) {
      this.searchControl.enable();
      this.searchControl.setValue('');
    } else {
      this.searchControl.disable();
      this.searchControl.setValue('');
    }
    this.filterItems(this.searchControl.value);
    this.emitFilterChange();
  }

  private filterItems(value: string | null) {
    if (!this.departamentoControl.value) {
      this.filteredItems = [];
      return;
    }

    const departamentoUsers = this.users.filter(
      (user) => user.DEPARTAMENTO === this.departamentoControl.value
    );

    if (!value) {
      this.filteredItems = departamentoUsers.map((user) => ({
        cargo: user.CARGO,
        nombre: `${user.NOMBRES} ${user.APELLIDOS}`,
      }));
    } else {
      const filterValue = value.toLowerCase();
      this.filteredItems = departamentoUsers
        .filter(
          (user) =>
            user.CARGO.toLowerCase().includes(filterValue) ||
            `${user.NOMBRES} ${user.APELLIDOS}`
              .toLowerCase()
              .includes(filterValue)
        )
        .map((user) => ({
          cargo: user.CARGO,
          nombre: `${user.NOMBRES} ${user.APELLIDOS}`,
        }));
    }
  }

  protected selectItem(item: { cargo: string, nombre: string }) {
    const searchValue = `${item.cargo} - ${item.nombre}`;
    this.searchControl.setValue(searchValue, { emitEvent: false });
    this.showDropdown = false;
    this.filterStateService.setFilters('seg_role_user', {
      departamento: this.departamentoControl.value || '',
      search: searchValue
    });
    this.emitFilterChange();
  }

  protected onInputFocus() {
    if (this.departamentoControl.value) {
      this.showDropdown = true;
    }
  }

  protected onInputBlur() {
    setTimeout(() => {
      this.showDropdown = false;
    }, 200);
  }

  private emitFilterChange() {
    this.filterChanged.emit({
      departamento: this.departamentoControl.value || '',
      search: this.searchControl.value || ''
    });
  }
}
