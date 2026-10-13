import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { RecomendacionVerificable } from '@features/ai-verificables-respon/models/recomendaciones_verif';

@Component({
  selector: 'app-search-filter-plan',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './search-filter-plan.component.html'
})
export class SearchFilterPlanComponent implements OnInit {
  protected searchTermControl = new FormControl('');
  @Input() originalData: RecomendacionVerificable[] = [];
  @Output() loadingChange = new EventEmitter<boolean>();
  @Output() filterChange = new EventEmitter<RecomendacionVerificable[]>();

  ngOnInit(): void {
    this.searchTermControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe((term) => {
        this.applyFilter(term || '');
      });
  }

  public updateOriginalData(data: RecomendacionVerificable[]): void {
    this.originalData = data;
    this.applyFilter(this.searchTermControl.value || '');
  }

  clearFilters(): void {
    this.searchTermControl.setValue('');
    this.applyFilter('');
  }

  private applyFilter(searchTerm: string): void {
    this.loadingChange.emit(true);
    let filtered = [...this.originalData];

    if (searchTerm && searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(item =>
        item.ainin_titulo?.toLowerCase().includes(term) ||
        item.ainin_memorando?.toLowerCase().includes(term) ||
        item.ainin_orden_trabajo?.toLowerCase().includes(term) ||
        item.ainin_memo_aprobacion?.toLowerCase().includes(term) ||
        item.ainin_usuario?.toLowerCase().includes(term) ||
        item.recomendaciones?.arere_descripcion?.toLowerCase().includes(term) ||
        item.recomendaciones?.arere_evidencia_requerida?.toLowerCase().includes(term)
      );
    }

    this.filterChange.emit(filtered);
    this.loadingChange.emit(false);
  }
}
