import { Injectable } from '@angular/core';

import { GetAllParameters, JSONAPIService } from '@xforge-common/jsonapi.service';
import { LiveQueryObservable } from '@xforge-common/live-query-observable';
import { ResourceService } from '@xforge-common/resource.service';
import { Project } from './models/project';

@Injectable()
export class ProjectService<T extends Project = Project> extends ResourceService {
  constructor(jsonApiService: JSONAPIService) {
    super(Project.TYPE, jsonApiService);
  }

  getAll(parameters?: GetAllParameters<T>, include?: string[]): LiveQueryObservable<T[]> {
    return this.jsonApiService.getAll(this.type, parameters, include);
  }

  update(project: T): Promise<void> {
    return this.jsonApiService.update(project);
  }

  onlineCreate(project: T): Promise<string> {
    return this.jsonApiService.onlineCreate(project);
  }
}