import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, OnInit, Output } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  FormControl
} from '@angular/forms';
import { BitacoraService } from '@features/ai-seg-bitacora/services/bitacora.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AlertsStateService } from '@core/services/alerts-state.service';

@Component({
  selector: 'app-search-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './search-filter.component.html',
  styleUrl: './search-filter.component.css',
})
export class SearchFilterComponent implements OnInit {
  @Output() filterChange = new EventEmitter<any>();
  @Output() export = new EventEmitter<void>();
  @Output() loadingChange = new EventEmitter<boolean>();
  protected readonly alertsService = inject(AlertsStateService);
  private readonly filterStateService = inject(FilterStateService);
  protected filterForm: FormGroup<any>;
  protected hasData = false;
  protected isLoading = false;

  constructor(
    private formBuilder: FormBuilder,
    private bitacoraSrv: BitacoraService
  ) {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    this.filterForm = this.formBuilder.group({
      startDate: [this.formatDate(sevenDaysAgo)],
      endDate: [this.formatDate(today)],
      searchTerm: ['']
    }, { validators: this.dateRangeValidator });
  }

  ngOnInit(): void {
    const savedFilters = this.filterStateService.getFilters('seg_bitacora');
    if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
    }

    this.loadingChange.emit(true);
    this.applyDateFilter();

    this.filterForm.valueChanges.subscribe((val) => {
      this.filterStateService.setFilters('seg_bitacora', val);
    });

    this.filterForm.get('startDate')?.valueChanges.subscribe(() => this.applyDateFilter());
    this.filterForm.get('endDate')?.valueChanges.subscribe(() => this.applyDateFilter());

    this.searchTermControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(term => {
        if (term === '') {
          this.applyDateFilter();
        } else {
          this.applySearchFilter(term);
        }
      });
  }

  clearFilters(): void {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    this.filterForm.setValue({
      startDate: this.formatDate(sevenDaysAgo),
      endDate: this.formatDate(today),
      searchTerm: ''
    }, { emitEvent: false });

    this.filterStateService.clearFilters('seg_bitacora');
    this.applyDateFilter();
  }

  get startDateControl(): FormControl {
    return this.filterForm.get('startDate') as FormControl;
  }

  get endDateControl(): FormControl {
    return this.filterForm.get('endDate') as FormControl;
  }

  get searchTermControl(): FormControl {
    return this.filterForm.get('searchTerm') as FormControl;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private applyDateFilter(): void {
    if (this.filterForm.valid) {
      this.isLoading = true;
      this.loadingChange.emit(true);

      const startDate = this.startDateControl.value;
      const endDate = this.endDateControl.value;

      this.bitacoraSrv.filterByDates(startDate, endDate).subscribe({
        next: (response) => {
          this.hasData = response.datos.length > 0;
          this.filterChange.emit(response.datos);
          this.isLoading = false;
          this.loadingChange.emit(false);
        },
        error: () => {
          this.alertsService.showAlert("Error al cargar los registros", "error");
          this.hasData = false;
          this.isLoading = false;
          this.loadingChange.emit(false);
        }
      });
    }
  }

  private applySearchFilter(term: string): void {
    const currentData = this.bitacoraSrv.getCurrentData();
    if (currentData) {
      this.isLoading = true;
      this.loadingChange.emit(true);
      const filteredData = currentData.filter(item =>
        item.tabla.toLowerCase().includes(term.toLowerCase()) ||
        item.host.toLowerCase().includes(term.toLowerCase()) ||
        item.usuario.toLowerCase().includes(term.toLowerCase())
      );
      this.hasData = filteredData.length > 0;
      this.filterChange.emit(filteredData);
      this.isLoading = false;
      this.loadingChange.emit(false);
    }
  }

  onExport(): void {
    this.export.emit();
  }

  private dateRangeValidator(group: FormGroup) {
    const startDate = group.get('startDate')?.value;
    const endDate = group.get('endDate')?.value;
    return startDate && endDate && startDate <= endDate ? null : { dateRangeInvalid: true };
  }
}
