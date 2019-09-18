import { MdcDialog } from '@angular-mdc/web';
import { ErrorHandler, Injectable } from '@angular/core';
import cloneDeep from 'lodash/cloneDeep';
import { User } from 'realtime-server/lib/common/models/user';
import { environment } from '../environments/environment';
import { ErrorReportingService } from './error-reporting.service.js';
import { ErrorAlert, ErrorComponent } from './error/error.component';
import { UserDoc } from './models/user-doc';
import { UserService } from './user.service';
import { objectId, promiseTimeout } from './utils';

type UserForReport = User & { id: string };

@Injectable({
  providedIn: 'root'
})
export class ExceptionHandlingService implements ErrorHandler {
  private alertQueue: ErrorAlert[] = [];
  private dialogOpen = false;
  private currentUser: UserDoc;
  private constructionTime = Date.now();

  constructor(
    private readonly dialog: MdcDialog,
    private readonly userService: UserService,
    private readonly errorReportingService: ErrorReportingService
  ) {}

  async handleError(error: any) {
    if (typeof error !== 'object' || error === null) {
      error = new Error('Unkown error: ' + String(error));
    }
    error = error.rejection && error.rejection.message ? error.rejection : error;

    console.log(`Error occured. Reporting to Bugsnag with release stage set to ${environment.releaseStage}:`);
    console.error(error);

    let message = typeof error.message === 'string' ? error.message.split('\n')[0] : 'Unknown error';

    if (
      message.includes('A mutation operation was attempted on a database that did not allow mutations.') &&
      window.navigator.userAgent.includes('Gecko/')
    ) {
      message = 'Firefox private browsing mode is not supported because IndexedDB is not avilable.';
    }

    const eventId = objectId();
    this.handleAlert({ message, stack: error.stack, eventId });
    this.sendReport(error, await this.getUserForReporting(), eventId);
  }

  /**
   * Returns a promise that will resolve to a ReportStyleUser representing the current user, or, if the user isn't
   * available within a reasonable time (within three seconds of the service being constructed), it will resolve with
   * null.
   */
  private async getUserForReporting(): Promise<UserForReport | undefined> {
    if (!this.currentUser) {
      try {
        this.currentUser = await promiseTimeout(
          this.userService.getCurrentUser(),
          Math.max(0, this.constructionTime + 3000 - Date.now())
        );
        if (!this.currentUser) {
          return undefined;
        }
      } catch {
        return undefined;
      }
    }
    const user = cloneDeep(this.currentUser.data) as UserForReport;
    user.id = this.currentUser.id;
    return user;
  }

  private sendReport(error: any, user: UserForReport, eventId: string) {
    this.errorReportingService.notify(
      error,
      {
        user,
        metaData: {
          eventId
        }
      },
      err => {
        if (err) {
          console.error('Sending error report failed:');
          console.error(err);
        }
      }
    );
  }

  private handleAlert(error: ErrorAlert) {
    if (!this.alertQueue.some(alert => alert.message === error.message)) {
      this.alertQueue.unshift(error);
      this.showAlert();
    }
  }

  private showAlert() {
    if (!this.dialogOpen && this.alertQueue.length) {
      this.dialogOpen = true;
      const dialog = this.dialog.open(ErrorComponent, { data: this.alertQueue[this.alertQueue.length - 1] });
      dialog.afterClosed().subscribe(() => {
        this.alertQueue.pop();
        this.dialogOpen = false;
        this.showAlert();
      });
    }
  }
}
