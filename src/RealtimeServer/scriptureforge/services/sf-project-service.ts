import { ProjectService } from '../../common/services/project-service';
import { ANY_INDEX } from '../../common/utils/obj-path';
import { SF_PROJECT_INDEX_PATHS, SF_PROJECTS_COLLECTION, SFProject } from '../models/sf-project';
import { SFProjectRole } from '../models/sf-project-role';
import { SF_PROJECT_MIGRATIONS } from './sf-project-migrations';

/**
 * This class manages SF project docs.
 */
export class SFProjectService extends ProjectService<SFProject> {
  readonly collection = SF_PROJECTS_COLLECTION;

  protected readonly indexPaths = SF_PROJECT_INDEX_PATHS;
  protected readonly projectAdminRole = SFProjectRole.ParatextAdministrator;

  constructor() {
    super(SF_PROJECT_MIGRATIONS);

    const immutableProps = [
      this.pathTemplate(p => p.sync),
      this.pathTemplate(p => p.paratextId),
      this.pathTemplate(p => p.texts, false),
      this.pathTemplate(p => p.texts[ANY_INDEX].bookNum),
      this.pathTemplate(p => p.texts[ANY_INDEX].chapters, false),
      this.pathTemplate(p => p.texts[ANY_INDEX].chapters[ANY_INDEX].isValid),
      this.pathTemplate(p => p.texts[ANY_INDEX].chapters[ANY_INDEX].lastVerse),
      this.pathTemplate(p => p.texts[ANY_INDEX].chapters[ANY_INDEX].number),
      this.pathTemplate(p => p.texts[ANY_INDEX].chapters[ANY_INDEX].permissions),
      this.pathTemplate(p => p.texts[ANY_INDEX].hasSource),
      this.pathTemplate(p => p.texts[ANY_INDEX].permissions),
      this.pathTemplate(p => p.translateConfig),
      this.pathTemplate(p => p.checkingConfig),
      this.pathTemplate(p => p.shortName),
      this.pathTemplate(p => p.writingSystem)
    ];
    this.immutableProps.push(...immutableProps);
  }
}
