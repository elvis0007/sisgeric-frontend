export interface ResponseReadMultiple<T> {
  mensajes: string;
  status: number;
  datos: T[];
}

export interface ResponseReadMultipeEeasa<T> {
  MESSAGE: string;
  DATA: T[];
}

export interface ResponseReadSimple<T> {
  mensaje: string;
  status: number;
  datos: T;
}
