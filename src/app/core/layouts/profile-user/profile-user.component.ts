import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { User } from '@core/auth/models/authentication';
import { ModalProfileUserService } from '@core/services/modal-profile-user.service';
import { AuxiliaryService } from '@shared/services/auxiliary.service';

@Component({
  selector: 'app-profile-user',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-user.component.html',
  styleUrl: './profile-user.component.css'
})
export class ProfileUserComponent implements OnInit {

  protected userPhotoUrl: string = 'sisrec/assets/images/avatar_profile.png';
  protected modalProfileUser: ModalProfileUserService = inject(ModalProfileUserService);
  protected user: User | null = null;
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);

  ngOnInit(): void {
     this.user = this.auxiliarySrv.getUserInfo();
     this.userPhotoUrl = `data:image/jpeg;base64,${this.user?.fotografia}` || this.userPhotoUrl;
  }

  closeModal(): void {
    this.modalProfileUser.closeModal();
  }

}
