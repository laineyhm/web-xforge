import { MdcDialog, MdcSelect, MdcTopAppBar } from '@angular-mdc/web';
import { Component, OnInit, ViewChild } from '@angular/core';
import { MediaChange, MediaObserver } from '@angular/flex-layout';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { distinctUntilChanged, filter, map, startWith, switchMap, tap } from 'rxjs/operators';
import { AccountService } from 'xforge-common/account.service';
import { AuthService } from 'xforge-common/auth.service';
import { LocationService } from 'xforge-common/location.service';
import { Site } from 'xforge-common/models/site';
import { SystemRole } from 'xforge-common/models/system-role';
import { AuthType, getAuthType, User } from 'xforge-common/models/user';
import { UserDoc } from 'xforge-common/models/user-doc';
import { NoticeService } from 'xforge-common/notice.service';
import { SubscriptionDisposable } from 'xforge-common/subscription-disposable';
import { UserService } from 'xforge-common/user.service';
import { nameof } from 'xforge-common/utils';
import { version } from '../../../version.json';
import { environment } from '../environments/environment';
import { HelpHeroService } from './core/help-hero.service';
import { SFProject } from './core/models/sfproject';
import { SFProjectDataDoc } from './core/models/sfproject-data-doc';
import { canTranslate, SFProjectRoles } from './core/models/sfproject-roles';
import { SFProjectUser } from './core/models/sfproject-user';
import { TextInfo } from './core/models/text-info';
import { SFProjectService } from './core/sfproject.service';
import { ProjectDeletedDialogComponent } from './project-deleted-dialog/project-deleted-dialog.component';
import { SFAdminAuthGuard } from './shared/sfadmin-auth.guard';

export const CONNECT_PROJECT_OPTION = '*connect-project*';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent extends SubscriptionDisposable implements OnInit {
  version: string = version;
  issueEmail: string = environment.issueEmail;
  isExpanded: boolean = false;
  translateVisible: boolean = false;
  checkingVisible: boolean = false;

  projects: SFProject[];
  isProjectAdmin$: Observable<boolean>;

  private currentUserDoc: UserDoc;
  private currentUserAuthType: AuthType;
  private _projectSelect: MdcSelect;
  private projectDeletedDialogRef: any;
  private _topAppBar: MdcTopAppBar;
  private _selectedProject: SFProject;
  private _isDrawerPermanent: boolean = true;
  private projectDataDoc: SFProjectDataDoc;
  private selectedProjectRole: SFProjectRoles;

  constructor(
    private readonly router: Router,
    private readonly accountService: AccountService,
    private readonly authService: AuthService,
    private readonly locationService: LocationService,
    private readonly helpHeroService: HelpHeroService,
    private readonly userService: UserService,
    private readonly noticeService: NoticeService,
    media: MediaObserver,
    private readonly projectService: SFProjectService,
    private readonly route: ActivatedRoute,
    private readonly adminAuthGuard: SFAdminAuthGuard,
    private readonly dialog: MdcDialog
  ) {
    super();
    this.subscribe(media.media$, (change: MediaChange) => {
      this.isDrawerPermanent = ['xl', 'lt-xl', 'lg', 'lt-lg'].includes(change.mqAlias);
    });
  }

  get issueMailTo(): string {
    return encodeURI('mailto:' + environment.issueEmail + '?subject=Scripture Forge v2 Issue');
  }

  @ViewChild('topAppBar')
  set topAppBar(value: MdcTopAppBar) {
    this._topAppBar = value;
    this.setTopAppBarVariant();
  }

  get projectSelect(): MdcSelect {
    return this._projectSelect;
  }

  @ViewChild(MdcSelect)
  set projectSelect(value: MdcSelect) {
    this._projectSelect = value;
    if (this._projectSelect != null) {
      setTimeout(() => {
        if (this.selectedProject != null) {
          this._projectSelect.reset();
          this._projectSelect.value = this.selectedProject.id;
        }
      });
    }
  }

  get selectedProject(): SFProject {
    return this._selectedProject;
  }

  set selectedProject(value: SFProject) {
    this._selectedProject = value;
    this.setTopAppBarVariant();
  }

  get isDrawerPermanent(): boolean {
    return this._isDrawerPermanent;
  }

  set isDrawerPermanent(value: boolean) {
    if (this._isDrawerPermanent !== value) {
      this._isDrawerPermanent = value;
      if (!this._isDrawerPermanent) {
        this.collapseDrawer();
      }
      this.setTopAppBarVariant();
    }
  }

  get isLoggedIn(): Promise<boolean> {
    return this.authService.isLoggedIn;
  }

  get isLoading(): boolean {
    return this.noticeService.isLoading;
  }

  get isSystemAdmin(): boolean {
    return this.authService.currentUserRole === SystemRole.SystemAdmin;
  }

  get isTranslateEnabled(): boolean {
    return (
      this.selectedProject != null &&
      this.selectedProject.translateEnabled != null &&
      this.selectedProject.translateEnabled &&
      canTranslate(this.selectedProjectRole)
    );
  }

  get translateTexts(): TextInfo[] {
    return this.texts.filter(t => t.hasSource);
  }

  get isCheckingEnabled(): boolean {
    return (
      this.selectedProject != null &&
      this.selectedProject.checkingEnabled != null &&
      this.selectedProject.checkingEnabled
    );
  }

  get checkingTexts(): TextInfo[] {
    return this.texts;
  }

  get currentUser(): User {
    return this.currentUserDoc == null ? undefined : this.currentUserDoc.data;
  }

  get canChangePassword(): boolean {
    return this.currentUserAuthType === AuthType.Account;
  }

  private get texts(): TextInfo[] {
    return this.projectDataDoc == null || this.projectDataDoc.data == null ? [] : this.projectDataDoc.data.texts;
  }

  private get site(): Site {
    return this.currentUser == null ? undefined : this.currentUser.sites[environment.siteId];
  }

  async ngOnInit(): Promise<void> {
    this.noticeService.loadingStarted();
    this.authService.init();
    if (await this.isLoggedIn) {
      this.projectService.init();
      this.currentUserDoc = await this.userService.getCurrentUser();
      this.currentUserAuthType = getAuthType(this.currentUserDoc.data.authId);

      // retrieve the projectId from the current route. Since the nav menu is outside of the router outlet, it cannot
      // use ActivatedRoute to get the params. Instead the nav menu, listens to router events and traverses the route
      // tree to find the currently activated route
      const projectId$ = this.router.events.pipe(
        filter(e => e instanceof NavigationEnd),
        startWith(null),
        map(() => {
          let route = this.route.snapshot;
          while (route.firstChild != null) {
            route = route.firstChild;
          }
          return route;
        }),
        filter(r => r.outlet === 'primary'),
        tap(r => {
          // ensure that the task of the current view has been expanded
          for (const segment of r.url) {
            if (segment.path === 'translate') {
              this.translateVisible = true;
              break;
            } else if (segment.path === 'checking') {
              this.checkingVisible = true;
              break;
            }
          }
        }),
        map(r => r.params['projectId'] as string),
        distinctUntilChanged(),
        tap(projectId => {
          this.isProjectAdmin$ = this.adminAuthGuard.allowTransition(projectId);
          // the project deleted dialog should be closed by now, so we can reset its ref to null
          if (projectId == null) {
            this.projectDeletedDialogRef = null;
          }
        })
      );

      // populate the projects dropdown and select the current project
      this.subscribe(
        projectId$.pipe(
          switchMap(projectId =>
            this.userService
              .getProjects(this.userService.currentUserId, [[nameof<SFProjectUser>('project')]])
              .pipe(map(r => ({ results: r, projectId })))
          )
        ),
        resultsAndProjectId => {
          const results = resultsAndProjectId.results;
          const projectId = resultsAndProjectId.projectId;
          this.projects = results.data.map(pu => results.getIncluded<SFProject>(pu.project)).filter(p => p != null);
          // if the project deleted dialog is displayed, don't do anything
          if (this.projectDeletedDialogRef != null) {
            return;
          }
          const selectedProject = projectId == null ? undefined : this.projects.find(p => p.id === projectId);

          // check if the currently selected project has been deleted
          if (selectedProject == null && projectId != null) {
            if (this.selectedProject != null && projectId === this.selectedProject.id) {
              if (this.site != null && this.site.currentProjectId != null) {
                // the project was deleted remotely, so notify the user
                this.showProjectDeletedDialog(this.site.currentProjectId);
              } else {
                // the project was deleted locally, so navigate to the start view
                this.navigateToStart();
              }
              return;
            } else {
              // the current project does not exist locally.
              // Check if the project exists online. If it doesn't, navigate to the start component.
              // If we don't check, we could be waiting forever.
              this.checkProjectExists(projectId);
            }
          }

          this.selectedProject = selectedProject;
          this.selectedProjectRole =
            this.selectedProject == null
              ? undefined
              : (results.data.find(pu => pu.project.id === this.selectedProject.id).role as SFProjectRoles);

          // Return early if 'Connect project' was clicked, or if we don't have all the
          // properties we need yet for the below or template.
          if (
            this.selectedProject == null ||
            this.selectedProject.translateEnabled == null ||
            this.selectedProject.checkingEnabled == null ||
            this.selectedProject.id == null ||
            this.selectedProject.projectName == null
          ) {
            return;
          }

          this.projectService.getDataDoc(this.selectedProject.id).then(doc => (this.projectDataDoc = doc));
          if (!this.isTranslateEnabled) {
            this.translateVisible = false;
          }
          if (!this.isCheckingEnabled) {
            this.checkingVisible = false;
          }
          if (this._projectSelect != null) {
            this._projectSelect.reset();
            this._projectSelect.value = this.selectedProject.id;
          }

          if (this.site == null || this.site.currentProjectId !== this.selectedProject.id) {
            this.currentUserDoc.submitJson0Op(op =>
              op.set(u => u.sites[environment.siteId].currentProjectId, this.selectedProject.id)
            );
          }
        }
      );
      // tell HelpHero to remember this user to make sure we won't show them an identical tour again later
      this.helpHeroService.setIdentity(this.userService.currentUserId);
    }
    this.noticeService.loadingFinished();
  }

  changePassword(): void {
    this.authService
      .changePassword(this.currentUser.email)
      .then(result => {
        this.noticeService.show(result);
      })
      .catch(() => {
        const message = "Can't change password at this time. Try again later or report an issue in the Help menu.";
        this.noticeService.show(message);
      });
  }

  editName(currentName: string): void {
    const dialogRef = this.accountService.openNameDialog(currentName, false);
    dialogRef.afterClosed().subscribe(response => {
      this.currentUserDoc.submitJson0Op(op => op.set(u => u.name, response as string));
    });
  }

  logOut(): void {
    this.authService.logOut();
  }

  async goHome(): Promise<void> {
    (await this.isLoggedIn) ? this.router.navigateByUrl('/projects') : this.locationService.go('/');
  }

  projectChanged(value: string): void {
    if (value === CONNECT_PROJECT_OPTION) {
      if (!this.isDrawerPermanent) {
        this.collapseDrawer();
      }
      this.router.navigateByUrl('/connect-project');
    } else if (value !== '' && this.selectedProject != null && value !== this.selectedProject.id) {
      this.router.navigate(['/projects', value]);
    }
  }

  itemSelected(): void {
    if (!this.isDrawerPermanent) {
      this.collapseDrawer();
    }
  }

  collapseDrawer() {
    this.isExpanded = false;
  }

  openDrawer() {
    this.isExpanded = true;
  }

  toggleDrawer() {
    this.isExpanded = !this.isExpanded;
  }

  drawerCollapsed(): void {
    this.isExpanded = false;
  }

  private async checkProjectExists(projectId: string): Promise<void> {
    if (!(await this.projectService.onlineExists(projectId))) {
      await this.currentUserDoc.submitJson0Op(op => op.unset(u => u.sites[environment.siteId].currentProjectId));
      this.navigateToStart();
    }
  }

  private async showProjectDeletedDialog(projectId: string): Promise<void> {
    await this.currentUserDoc.submitJson0Op(op => op.unset(u => u.sites[environment.siteId].currentProjectId));
    this.projectDeletedDialogRef = this.dialog.open(ProjectDeletedDialogComponent);
    this.projectDeletedDialogRef.afterClosed().subscribe(() => {
      this.projectService.localDelete(projectId);
      this.navigateToStart();
    });
  }

  private navigateToStart(): void {
    setTimeout(() => this.router.navigateByUrl('/projects', { replaceUrl: true }));
  }

  private setTopAppBarVariant(): void {
    if (this._topAppBar == null) {
      return;
    }

    const isShort = this._isDrawerPermanent && this._selectedProject != null;
    if (isShort !== this._topAppBar.short) {
      this._topAppBar.setShort(isShort, true);
    }
  }
}
