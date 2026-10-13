import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SearchFilterResponComponent } from './search-filter-respon.component';

describe('SearchFilterResponComponent', () => {
  let component: SearchFilterResponComponent;
  let fixture: ComponentFixture<SearchFilterResponComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchFilterResponComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SearchFilterResponComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
