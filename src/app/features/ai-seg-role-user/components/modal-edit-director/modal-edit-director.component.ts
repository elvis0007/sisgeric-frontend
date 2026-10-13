import { CommonModule } from '@angular/common';
import { Component, effect, inject, OnInit, HostListener } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { UsuarioAsignadoRol, PersonalInfoListado } from '@features/ai-seg-role-user/models/user';
import { RolUsuarioActualizacion } from '@features/ai-seg-role-user/models/role-user';
import { ModalEditService } from '@features/ai-seg-role-user/services/modal-edit.service';
import { RoleUserService } from '@features/ai-seg-role-user/services/role-user.service';
import { UserService } from '@features/ai-seg-role-user/services/user.service';
import { ResponseReadMultiple, ResponseReadSimple, ResponseReadMultipeEeasa } from '@shared/models/response-read';
import { ResponseWrite } from '@shared/models/response-write';
import { ReportsAuditorGenService } from '@features/ai-report-auditor-general/services/reports-auditor-gen.service';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { Auditoria } from '@shared/models/audit';
import { SearchFilterComponent } from '@features/ai-seg-role-user/components/search-filter/search-filter.component';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';

@Component({
  selector: 'app-modal-edit-director',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, SearchFilterComponent, PaginationComponent],
  templateUrl: './modal-edit-director.component.html',
  styleUrl: './modal-edit-director.component.css',
})
export class ModalEditDirectorComponent implements OnInit {
  protected modalEditSrv: ModalEditService = inject(ModalEditService);
  protected roleUserSrv: RoleUserService = inject(RoleUserService);
  protected userService: UserService = inject(UserService);
  protected alertsService = inject(AlertsStateService);
  protected reportsService = inject(ReportsAuditorGenService);
  private readonly auxiliarySrv = inject(AuxiliaryService);
  
  protected formEdit!: FormGroup;
  protected data: { user: UsuarioAsignadoRol; roleId: number } | null = null;
  protected departamentos: string[] = [];
  protected usuarios: PersonalInfoListado[] = [];
  protected filteredUsers: PersonalInfoListado[] = [];
  protected displayedUsers: PersonalInfoListado[] = [];
  protected usuarioActual: UsuarioAsignadoRol | null = null;
  protected selectedUsuarioCodigo: string = '';
  protected selectedUsuarioNombre: string = '';
  protected showUsuarioTable: boolean = false;
  protected isLoading = false;
  protected isLoadingDepartamentos = false;
  protected isLoadingUsuario = false;
  protected isLoadingUsuarios = false;
  private usuariosCargados = false;
  private usuarioActualCargado = false;
  private currentDepartamento: string = '';
  protected currentSearchTerm: string = '';
  protected currentPage: number = 1;
  protected itemsPerPage: number = 50;

  private get audit(): Auditoria {
    return {
      host: this.auxiliarySrv.getHost(),
      usuario: this.auxiliarySrv.getUserCuenta(),
    };
  }

  constructor() {
    effect(() => {
      this.data = this.modalEditSrv.modalData();
      if (this.data) {
        this.loadUsuarioActual();
        this.loadUsuarios();
        this.loadDepartamentos();
      }
    });
  }

  ngOnInit(): void {
    // Los datos se cargan cuando se abre el modal (en el effect)
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    // Cerrar el dropdown si se hace clic fuera
    if (this.showUsuarioTable && !target.closest('.dropdown')) {
      this.showUsuarioTable = false;
    }
  }

  private loadUsuarioActual(): void {
    if (!this.data) return;
    
    const currentData = this.data; // Guardar referencia para usar en el callback
    this.isLoadingUsuario = true;
    this.usuarioActualCargado = false;
    this.roleUserSrv.obtenerUsuarioPorId(currentData.user.aseru_codigo).subscribe({
      next: (response: ResponseReadSimple<UsuarioAsignadoRol>) => {
        this.usuarioActual = response.datos;
        this.usuarioActualCargado = true;
        this.tryInitForm();
        this.isLoadingUsuario = false;
      },
      error: () => {
        // Si falla, usar los datos que ya tenemos
        if (currentData) {
          this.usuarioActual = currentData.user;
          this.usuarioActualCargado = true;
          this.tryInitForm();
          this.isLoadingUsuario = false;
        }
      },
    });
  }

  private loadUsuarios(): void {
    this.isLoadingUsuarios = true;
    this.usuariosCargados = false;
    // Resetear filtros al cargar usuarios
    this.currentDepartamento = '';
    this.currentSearchTerm = '';
    this.userService.getPersonalInfo().subscribe({
      next: (response: ResponseReadMultipeEeasa<PersonalInfoListado>) => {
        this.usuarios = response.DATA;
        // Mostrar todos los usuarios inicialmente
        this.filteredUsers = [...this.usuarios];
        this.updateDisplayedUsers();
        this.usuariosCargados = true;
        this.tryInitForm();
        this.isLoadingUsuarios = false;
      },
      error: () => {
        this.alertsService.showAlert('Error al cargar los usuarios', 'error');
        this.usuariosCargados = true; // Marcar como cargado aunque haya error para no bloquear
        this.tryInitForm();
        this.isLoadingUsuarios = false;
      },
    });
  }

  protected onFilterChanged(filterData: { departamento: string; search: string }) {
    this.currentDepartamento = filterData.departamento;
    this.currentSearchTerm = filterData.search;
    this.applyFilters();
    this.currentPage = 1;
    this.updateDisplayedUsers();
  }

  private applyFilters(): void {
    this.filteredUsers = this.usuarios.filter((user) => {
      // Filtro por departamento
      const matchDepartamento =
        this.currentDepartamento === '' ||
        user.DEPARTAMENTO === this.currentDepartamento;

      // Filtro por búsqueda
      if (this.currentSearchTerm === '') {
        return matchDepartamento;
      }

      // Si el término de búsqueda contiene " - ", es una selección del dropdown
      if (this.currentSearchTerm.includes(' - ')) {
        const parts = this.currentSearchTerm.split(' - ');
        // El nombre está en la última parte, el cargo puede estar en las primeras partes
        const searchNombre = parts[parts.length - 1]?.trim() || '';
        const searchCargo = parts.slice(0, -1).join(' - ').trim();
        const userFullName = `${user.NOMBRES} ${user.APELLIDOS}`.trim();
        const userCargo = user.CARGO.trim();
        
        // Comparación más flexible: buscar coincidencia en cargo o nombre
        const matchCargo = searchCargo && userCargo.toLowerCase().includes(searchCargo.toLowerCase());
        const matchNombre = searchNombre && userFullName.toLowerCase().includes(searchNombre.toLowerCase());
        
        // Debe coincidir el nombre completo (más importante) y opcionalmente el cargo
        return matchDepartamento && matchNombre && (matchCargo || !searchCargo);
      } else {
        // Búsqueda libre por texto
        const searchLower = this.currentSearchTerm.toLowerCase();
        const matchCargo = user.CARGO.toLowerCase().includes(searchLower);
        const matchNombre = `${user.NOMBRES} ${user.APELLIDOS}`.toLowerCase().includes(searchLower);
        
        return matchDepartamento && (matchCargo || matchNombre);
      }
    });

    this.updateDisplayedUsers();
  }

  private updateDisplayedUsers(): void {
    // Si hay un término de búsqueda específico (selección del dropdown), mostrar todos los resultados
    if (this.currentSearchTerm && this.currentSearchTerm.includes(' - ')) {
      this.displayedUsers = this.filteredUsers;
    } else {
      // Para búsquedas generales o sin filtro, usar paginación
      const startIndex = (this.currentPage - 1) * this.itemsPerPage;
      this.displayedUsers = this.filteredUsers.slice(
        startIndex,
        startIndex + this.itemsPerPage
      );
    }
  }

  protected onPageChange(page: number): void {
    this.currentPage = page;
    this.updateDisplayedUsers();
  }

  protected onItemsPerPageChange(itemsPerPage: number): void {
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1;
    this.updateDisplayedUsers();
  }

  protected toggleUsuarioTable(): void {
    this.showUsuarioTable = !this.showUsuarioTable;
  }

  protected selectUsuarioFromTable(usuario: PersonalInfoListado): void {
    this.selectedUsuarioCodigo = usuario.CODIGO;
    this.selectedUsuarioNombre = `${usuario.NOMBRES} ${usuario.APELLIDOS} - ${usuario.CARGO}`;
    this.showUsuarioTable = false;
    if (this.formEdit) {
      this.formEdit.patchValue({ codigo_per: usuario.CODIGO });
    }
  }

  private tryInitForm(): void {
    // Solo inicializar el formulario cuando ambos estén cargados
    if (this.usuarioActualCargado && this.usuariosCargados) {
      this.initForm();
    }
  }

  private loadDepartamentos(): void {
    this.isLoadingDepartamentos = true;
    this.reportsService.getDepartamentos().subscribe({
      next: (response: ResponseReadMultiple<string>) => {
        this.departamentos = response.datos;
        this.isLoadingDepartamentos = false;
      },
      error: () => {
        this.alertsService.showAlert('Error al cargar los departamentos', 'error');
        this.isLoadingDepartamentos = false;
      },
    });
  }

  private initForm(): void {
    if (!this.data || !this.usuarioActual) return;

    // Usar codigo_per del usuario actual si está disponible, sino buscarlo en la lista
    let codigoPer = this.usuarioActual.codigo_per;
    if (!codigoPer) {
      const usuarioEnLista = this.usuarios.find(
        u => u.USUARIO === this.usuarioActual?.dsgus_cuenta
      );
      codigoPer = usuarioEnLista?.CODIGO || '';
    }

    this.selectedUsuarioCodigo = codigoPer;
    
    // Buscar el nombre del usuario seleccionado
    const usuarioSeleccionado = this.usuarios.find(u => u.CODIGO === codigoPer);
    if (usuarioSeleccionado) {
      this.selectedUsuarioNombre = `${usuarioSeleccionado.NOMBRES} ${usuarioSeleccionado.APELLIDOS} - ${usuarioSeleccionado.CARGO}`;
    }

    this.formEdit = new FormGroup({
      aseru_codigo: new FormControl(this.usuarioActual.aseru_codigo),
      codigo_per: new FormControl(codigoPer, Validators.required),
      departamento: new FormControl(this.usuarioActual.departamento || '', Validators.required),
    });
  }

  protected onSubmit(): void {
    if (this.formEdit.valid && this.data && this.usuarioActual) {
      this.isLoading = true;
      
      const aseruCodigo = this.usuarioActual.aseru_codigo;
      const codigoPer = this.formEdit.get('codigo_per')?.value;
      
      const updateData: Omit<RolUsuarioActualizacion, 'aseru_codigo'> = {
        codigo_per: codigoPer,
        rol: this.data.roleId,
        aseru_cuenta: '', // El backend lo obtiene del codigo_per
        email: '', // El backend lo obtiene del codigo_per
        departamento: this.formEdit.get('departamento')?.value,
        auditoria: this.audit,
      };

      this.roleUserSrv.actualizarUsuario(aseruCodigo, updateData).subscribe({
        next: (response: ResponseWrite) => {
          this.alertsService.showAlert(
            response.mensaje || 'Director actualizado correctamente',
            'success'
          );
          this.modalEditSrv.closeModal();
          this.isLoading = false;
        },
        error: (error) => {
          const errorMessage = error.error?.mensaje || 'Error al actualizar el director';
          this.alertsService.showAlert(errorMessage, 'error');
          this.isLoading = false;
        },
      });
    } else {
      this.formEdit.markAllAsTouched();
    }
  }

  protected closeModal(): void {
    // Resetear filtros al cerrar el modal
    this.currentDepartamento = '';
    this.currentSearchTerm = '';
    this.currentPage = 1;
    this.selectedUsuarioCodigo = '';
    this.selectedUsuarioNombre = '';
    this.showUsuarioTable = false;
    this.modalEditSrv.closeModal();
  }
}

