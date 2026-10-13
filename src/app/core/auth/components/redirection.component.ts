import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-redirection',
  standalone: true,
  template: '',
})
export class RedirectionComponent implements OnInit {

  ngOnInit(): void {
    if (typeof window !== undefined) {
      window.location.href = 'https://app.eeasa.com.ec/intranet#/';
    }
  }
}
