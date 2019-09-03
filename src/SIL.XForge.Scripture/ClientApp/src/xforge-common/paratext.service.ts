import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { InputSystem } from 'realtime-server/lib/common/models/input-system';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { ParatextProject } from './models/paratext-project';

@Injectable({
  providedIn: 'root'
})
export class ParatextService {
  static getInputSystem(project: ParatextProject): InputSystem {
    return {
      tag: project.languageTag,
      languageName: project.languageName,
      isRightToLeft: false
    };
  }

  constructor(private readonly http: HttpClient, private readonly authService: AuthService) {}

  linkParatext(returnUrl: string): void {
    this.authService.linkParatext(returnUrl);
  }

  getProjects(): Observable<ParatextProject[]> {
    return this.http.get<ParatextProject[]>('paratext-api/projects', { headers: this.getHeaders() });
  }

  getParatextUsername(): Observable<string> {
    return this.http.get<string>('paratext-api/username', { headers: this.getHeaders() });
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json'
    });
  }
}
