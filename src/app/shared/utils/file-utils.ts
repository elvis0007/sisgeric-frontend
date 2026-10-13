import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class FileUtils {
  public getFileName(urlFile: string): string {
    if (!urlFile) return '';
    return urlFile.split('/').pop() || '';
  }
}
