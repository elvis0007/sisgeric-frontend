import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { interceptorJWT } from '@core/auth/interceptors/jwt.interceptor';
import { errorHttpInterceptor } from '@shared/interceptors/error-http.interceptor';
import { ObjectEncryptor } from '@shared/utils/object-encryptor';
import { HashLocationStrategy, LocationStrategy } from '@angular/common';

export const appConfig: ApplicationConfig = {
  providers: [provideZoneChangeDetection({ eventCoalescing: true }), provideRouter(routes),
    { provide: LocationStrategy, useClass: HashLocationStrategy },
    provideHttpClient(
      withInterceptors([
        interceptorJWT(new ObjectEncryptor),
        errorHttpInterceptor,
      ]) 
    )
  ]
};
