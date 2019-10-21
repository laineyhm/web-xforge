import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { SFProjectRole } from 'realtime-server/lib/scriptureforge/models/sf-project-role';
import { from, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { AuthGuard } from 'xforge-common/auth.guard';
import { UserService } from 'xforge-common/user.service';
import { SFProjectDoc } from '../core/models/sf-project-doc';
import { canAccessTranslateApp } from '../core/models/sf-project-role-info';
import { SFProjectService } from '../core/sf-project.service';

@Injectable({
  providedIn: 'root'
})
abstract class RouterGuard implements CanActivate {
  constructor(
    public readonly authGuard: AuthGuard,
    public readonly userService: UserService,
    public readonly projectService: SFProjectService,
    public readonly router: Router
  ) {}

  canActivate(next: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    const projectId = 'projectId' in next.params ? next.params['projectId'] : '';
    return this.authGuard.canActivate(next, state).pipe(switchMap(() => this.allowTransition(projectId)));
  }

  allowTransition(projectId: string): Observable<boolean> {
    return this.authGuard.allowTransition().pipe(
      switchMap(isLoggedIn => {
        if (isLoggedIn) {
          return from(this.projectService.get(projectId)).pipe(map(projectDoc => this.check(projectDoc)));
        }
        return of(false);
      })
    );
  }

  abstract check(project: SFProjectDoc): boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SFAdminAuthGuard extends RouterGuard {
  check(projectDoc: SFProjectDoc): boolean {
    return (
      projectDoc.data != null &&
      projectDoc.data.userRoles[this.userService.currentUserId] === SFProjectRole.ParatextAdministrator
    );
  }
}

@Injectable({
  providedIn: 'root'
})
export class CheckingAuthGuard extends RouterGuard {
  check(projectDoc: SFProjectDoc): boolean {
    if (projectDoc.data != null && projectDoc.data.checkingConfig.checkingEnabled) {
      return true;
    }
    this.router.navigate(['/projects', projectDoc.id], { replaceUrl: true });
    return false;
  }
}

@Injectable({
  providedIn: 'root'
})
export class TranslateAuthGuard extends RouterGuard {
  check(projectDoc: SFProjectDoc): boolean {
    if (projectDoc.data != null) {
      const role = projectDoc.data.userRoles[this.userService.currentUserId] as SFProjectRole;
      if (canAccessTranslateApp(role)) {
        return true;
      }
    }
    this.router.navigate(['/projects', projectDoc.id], { replaceUrl: true });
    return false;
  }
}