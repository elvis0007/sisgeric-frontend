import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ResponsableInfo } from '@features/ai-seguim-auditor-operativo/models/responsable';
import { debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-filter-responsables',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './filter-responsables.component.html',
  styleUrl: './filter-responsables.component.css',
})
export class FilterResponsablesComponent implements OnInit, OnChanges {
  @Input() users: ResponsableInfo[] = [];
  @Output() filterChanged = new EventEmitter<{
    departamento: string;
    search: string;
  }>();

  protected departamentos: string[] = [];
  protected departamentoControl = new FormControl('');
  protected searchControl = new FormControl({ value: '', disabled: true });

  ngOnInit() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(value => {
        if (value === '') {
          this.emitFilterChange();
        } else {
          this.emitFilterChange();
        }
      });

    this.departamentoControl.valueChanges.subscribe(() => {
      this.onDepartamentoChange();
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['users'] && changes['users'].currentValue) {
      this.initializeDepartamentos();
    }
  }

  protected onDepartamentoChange() {
    if (this.departamentoControl.value) {
      this.searchControl.enable();
      this.searchControl.setValue('');
    } else {
      this.searchControl.disable();
      this.searchControl.setValue('');
    }
    this.emitFilterChange();
  }

  private initializeDepartamentos() {
    this.departamentos = [
      ...new Set(this.users.map((user) => user.DEPARTAMENTO)),
    ].sort();
  }

  private emitFilterChange() {
    this.filterChanged.emit({
      departamento: this.departamentoControl.value || '',
      search: this.searchControl.value || '',
    });
  }

  public resetFilters() {
    this.departamentoControl.setValue('');
    this.searchControl.setValue('');
    this.searchControl.disable();
    this.emitFilterChange();
  }
}
