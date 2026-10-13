import { Component, effect, inject, Input, OnInit } from '@angular/core';
import { FormRoleComponent } from '@features/ai-seg-role/components/form-role/form-role.component';
import { ModalService } from '@features/ai-seg-role/services/modal.service';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Rol } from '@features/ai-seg-role/models/role';

@Component({
  selector: 'app-modal-create-edit',
  standalone: true,
  imports: [FormRoleComponent, CommonModule],
  templateUrl: './modal-create-edit.component.html',
  styleUrl: './modal-create-edit.component.css',
})
export class ModalCreateEditComponent implements OnInit {
  protected modalService: ModalService = inject(ModalService);
  protected formRole!: FormGroup;
  protected data!: Rol;

  ngOnInit(): void {
    this.initForm();
  }
  constructor() {
    effect(() => {
      this.data = this.modalService.modalData();
      this.initForm();
    });
  }

  private initForm() {
    this.formRole = new FormGroup({
      asero_codigo: new FormControl(this.data?.asero_codigo || null),
      asero_descripcion: new FormControl(
        this.data?.asero_descripcion || '',
        Validators.required // Se agrega el validador 'required'
      ),
    });
  }

  protected closeModal(): void {
    this.modalService.closeModal();
  }
}
