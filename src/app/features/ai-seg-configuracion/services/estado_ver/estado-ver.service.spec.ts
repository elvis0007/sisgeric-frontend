import { TestBed } from '@angular/core/testing';

import { EstadoVerService } from './estado-ver.service';

describe('EstadoVerService', () => {
  let service: EstadoVerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EstadoVerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
