import { Component, EventEmitter, Input, OnInit, OnDestroy, Output, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RecomendacionVerificable } from '@features/ai-verificables-respon/models/recomendaciones_verif';
import { FilterStateService } from '@core/services/filter-state.service';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-search-filter-respon',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './search-filter-respon.component.html',
  styleUrl: './search-filter-respon.component.css'
})
export class SearchFilterResponComponent implements OnInit, OnDestroy {
  private queryParamsSub!: Subscription;
  protected filterForm: FormGroup<any>;
  @Input() originalData: RecomendacionVerificable[] = [];
  @Output() loadingChange = new EventEmitter<boolean>();
  @Output() filterChange = new EventEmitter<RecomendacionVerificable[]>();
  protected isLoading = false;
  protected hasData = false;
  private readonly filterStateService = inject(FilterStateService);
  private readonly route = inject(ActivatedRoute);

  constructor(private formBuilder: FormBuilder) {
    this.filterForm = this.formBuilder.group(
      {
        searchTerm: [''],
      }
    );
  }

  ngOnInit() {
    this.queryParamsSub = this.route.queryParams.subscribe(params => {
      const searchParam = params['search'];
      if (searchParam) {
        this.searchTermControl.setValue(searchParam, { emitEvent: false });
        if (this.originalData && this.originalData.length > 0) {
          this.applySearchFilter(searchParam);
        }
      } else {
        const savedFilters = this.filterStateService.getFilters('verificables_respon');
        if (savedFilters) {
          this.filterForm.patchValue(savedFilters, { emitEvent: false });
          if (this.originalData && this.originalData.length > 0) {
            this.applySearchFilter(savedFilters.searchTerm || '');
          }
        }
      }
    });

    this.filterForm.valueChanges.subscribe((val) => {
      this.filterStateService.setFilters('verificables_respon', val);
    });

    this.searchTermControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((searchTerm) => {
        this.applySearchFilter(searchTerm as string);
      });
  }

  ngOnDestroy() {
    if (this.queryParamsSub) {
      this.queryParamsSub.unsubscribe();
    }
  }

  get searchTermControl(): FormControl {
    return this.filterForm.get('searchTerm') as FormControl;
  }

  reloadVerificables(): void {
    this.loadingChange.emit(true);
    this.searchTermControl.setValue('');
    setTimeout(() => {
      this.applySearchFilter('');
    }, 0);
  }

  clearFilters(): void {
    this.filterForm.setValue({
      searchTerm: ''
    }, { emitEvent: false });

    this.filterStateService.clearFilters('verificables_respon');
    this.applySearchFilter('');
  }

  public updateOriginalData(data: RecomendacionVerificable[]): void {
    this.originalData = data;
    const term = this.searchTermControl.value;
    if (term) {
      this.applySearchFilter(term);
    }
  }

  private applySearchFilter(searchTerm: string): void {
    const currentData = this.originalData;
    
    this.isLoading = true;
    this.loadingChange.emit(true);
    
    let filteredData: RecomendacionVerificable[] = [];
    
    if (currentData && currentData.length > 0) {
      if (!searchTerm || searchTerm.trim() === '') {
        filteredData = [...currentData];
      } else {
        filteredData = currentData.filter(
          (item) =>
            item.ainin_titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.ainin_orden_trabajo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.ainin_memo_aprobacion.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.ainin_usuario?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.ainin_memorando?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.recomendaciones.arere_descripcion.toLowerCase().includes(searchTerm.toLowerCase()) 
        );
      }
    }
    
    this.hasData = filteredData.length > 0;
    this.filterChange.emit(filteredData);
    this.isLoading = false;
    this.loadingChange.emit(false);
  }
}
