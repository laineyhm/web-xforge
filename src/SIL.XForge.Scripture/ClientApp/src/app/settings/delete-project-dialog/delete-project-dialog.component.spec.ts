import { MdcDialog, MdcDialogConfig, MdcDialogRef } from '@angular-mdc/web/dialog';
import { NgModule } from '@angular/core';
import { ComponentFixture, fakeAsync, flush, inject, TestBed, tick } from '@angular/core/testing';
import { CookieService } from 'ngx-cookie-service';
import { mock } from 'ts-mockito';
import { AuthService } from 'xforge-common/auth.service';
import { BugsnagService } from 'xforge-common/bugsnag.service';
import { ChildViewContainerComponent, configureTestingModule, TestTranslocoModule } from 'xforge-common/test-utils';
import { UICommonModule } from 'xforge-common/ui-common.module';
import { DeleteProjectDialogComponent } from './delete-project-dialog.component';

const mockedBugsnagService = mock(BugsnagService);

describe('DeleteProjectDialogComponent', () => {
  configureTestingModule(() => ({
    imports: [DialogTestModule, UICommonModule],
    providers: [
      { provide: AuthService, useMock: mock(AuthService) },
      { provide: BugsnagService, useMock: mockedBugsnagService },
      { provide: CookieService, useMock: mock(CookieService) }
    ]
  }));

  let dialog: MdcDialog;
  let viewContainerFixture: ComponentFixture<ChildViewContainerComponent>;

  it('should allow user to delete the project', fakeAsync(() => {
    const env = new TestEnvironment();
    // Project name matching is case insensitive
    env.inputValue(env.projectInput, 'PrOjEcT01');
    expect(env.component.deleteDisabled).toBe(false);
    env.clickElement(env.deleteButton);
    flush();
    expect(env.afterCloseCallback).toHaveBeenCalledWith('accept');
  }));

  it('should not delete the project if project name does not match', fakeAsync(() => {
    const env = new TestEnvironment();
    env.inputValue(env.projectInput, 'project02');
    expect(env.component.deleteDisabled).toBe(true);
    env.clickElement(env.deleteButton);
    flush();
    expect(env.afterCloseCallback).toHaveBeenCalledTimes(0);
    env.clickElement(env.cancelButton);
    flush();
    expect(env.afterCloseCallback).toHaveBeenCalledWith('cancel');
  }));

  it('should allow user to cancel', fakeAsync(() => {
    const env = new TestEnvironment();
    env.clickElement(env.cancelButton);
    flush();
    expect(env.afterCloseCallback).toHaveBeenCalledWith('cancel');
  }));

  class TestEnvironment {
    fixture: ComponentFixture<ChildViewContainerComponent>;
    component: DeleteProjectDialogComponent;
    dialogRef: MdcDialogRef<DeleteProjectDialogComponent>;

    afterCloseCallback: jasmine.Spy;

    constructor() {
      this.afterCloseCallback = jasmine.createSpy('afterClose callback');
      const config: MdcDialogConfig = { data: { name: 'project01' } };
      this.dialogRef = dialog.open(DeleteProjectDialogComponent, config);
      this.dialogRef.afterClosed().subscribe(this.afterCloseCallback);
      this.component = this.dialogRef.componentInstance;
      this.fixture = viewContainerFixture;
      this.fixture.detectChanges();
    }

    get overlayContainerElement(): HTMLElement {
      return this.fixture.nativeElement.parentElement.querySelector('.cdk-overlay-container');
    }

    get deleteButton(): HTMLElement {
      return this.overlayContainerElement.querySelector('#project-delete-btn') as HTMLElement;
    }

    get cancelButton(): HTMLElement {
      return this.overlayContainerElement.querySelector('#cancel-btn') as HTMLElement;
    }

    get projectInput(): HTMLElement {
      return this.overlayContainerElement.querySelector('#project-entry') as HTMLElement;
    }

    inputValue(element: HTMLElement, value: string): void {
      const inputElem = element.querySelector('input') as HTMLInputElement;
      inputElem.value = value;
      inputElem.dispatchEvent(new Event('input'));
      this.fixture.detectChanges();
      tick();
    }

    clickElement(element: HTMLElement): void {
      element.click();
      this.fixture.detectChanges();
      tick();
    }
  }

  beforeEach(inject([MdcDialog], (d: MdcDialog) => {
    dialog = d;
  }));

  beforeEach(() => {
    viewContainerFixture = TestBed.createComponent(ChildViewContainerComponent);
  });
});

@NgModule({
  imports: [UICommonModule, TestTranslocoModule],
  declarations: [DeleteProjectDialogComponent],
  exports: [DeleteProjectDialogComponent]
})
class DialogTestModule {}
