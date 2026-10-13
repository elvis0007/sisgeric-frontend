import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';
import { environment } from '@environments/environment.development';

@Injectable({
  providedIn: 'root',
})
export class ObjectEncryptor {
  private secretKey: string = environment.app_key;
  private aesKey: string = environment.aes_key;
  encryptObject(object: any): string {
    const key = CryptoJS.enc.Utf8.parse(this.secretKey);
    const iv = CryptoJS.enc.Utf8.parse(this.secretKey);
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(object), key, {
      keySize: 128 / 8,
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return btoa(encrypted.toString());
  }

  decryptObject(object: string): any {
    const key = CryptoJS.enc.Utf8.parse(this.secretKey);
    const iv = CryptoJS.enc.Utf8.parse(this.secretKey);
    const decrypted = CryptoJS.AES.decrypt(atob(object), key, {
      keySize: 128 / 8,
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    const objectDecrypted = decrypted.toString(CryptoJS.enc.Utf8);
    try {
      return JSON.parse(objectDecrypted);
    } catch (error) {
      console.error('Error al parsear el valor desencriptado:', error);
      return null;
    }
  }

  encryptPassword(password: string): string {
    const key = CryptoJS.enc.Utf8.parse(this.aesKey.substring(0, 16));
    const iv = CryptoJS.enc.Utf8.parse(this.aesKey.substring(0, 16));
    const encrypted = CryptoJS.AES.encrypt(password, key, {
      keySize: 128 / 8,
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7, 
    });
    return encrypted.toString(); // Devuelve el texto cifrado
  }
}
