import { DebugElement } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ngfModule } from 'angular-file';
import { mock, when } from 'ts-mockito';
import { UserDoc } from 'xforge-common/models/user-doc';
import { NoticeService } from 'xforge-common/notice.service';
import { TestRealtimeService } from 'xforge-common/test-realtime.service';
import { configureTestingModule, getAudioBlob, TestTranslocoModule } from 'xforge-common/test-utils';
import { UICommonModule } from 'xforge-common/ui-common.module';
import { UserService } from 'xforge-common/user.service';
import { SF_REALTIME_DOC_TYPES } from '../../../core/models/sf-realtime-doc-types';
import { AudioTimePipe, CheckingAudioPlayerComponent } from '../checking-audio-player/checking-audio-player.component';
import { CheckingAudioRecorderComponent } from '../checking-audio-recorder/checking-audio-recorder.component';
import { CheckingAudioCombinedComponent } from './checking-audio-combined.component';

const mockedUserService = mock(UserService);
const mockedNoticeService = mock(NoticeService);

describe('CheckingAudioCombinedComponent', () => {
  configureTestingModule(() => ({
    declarations: [
      CheckingAudioCombinedComponent,
      CheckingAudioRecorderComponent,
      CheckingAudioPlayerComponent,
      AudioTimePipe
    ],
    imports: [UICommonModule, ngfModule, TestTranslocoModule],
    providers: [
      { provide: UserService, useMock: mockedUserService },
      { provide: NoticeService, useMock: mockedNoticeService }
    ]
  }));

  let env: TestEnvironment;

  beforeEach(() => {
    env = new TestEnvironment();
  });

  it('can upload an audio file and correct buttons show', () => {
    expect(env.uploadAudioButton).toBeTruthy();
    expect(env.component.source).toBe('');
    env.component.uploadAudioFile = new File([env.audioBlob], 'test.wav');
    env.component.prepareAudioFileUpload();
    env.fixture.detectChanges();
    expect(env.component.source).toContain('blob:http');
    expect(env.removeAudioButton).toBeTruthy();
    env.clickButton(env.removeAudioButton);
    expect(env.component.source).toBe('');
    expect(env.uploadAudioButton).toBeTruthy();
  });

  it('correct buttons appear throughout recording process', async () => {
    expect(env.recordButton).toBeTruthy();
    expect(env.uploadAudioButton).toBeTruthy();
    expect(env.removeAudioButton).toBeFalsy();
    expect(env.stopRecordingButton).toBeFalsy();
    env.clickButton(env.recordButton);
    await env.waitForRecorder(1000);
    expect(env.recordButton).toBeFalsy();
    expect(env.uploadAudioButton).toBeFalsy();
    expect(env.stopRecordingButton).toBeTruthy();
    env.clickButton(env.stopRecordingButton);
    await env.waitForRecorder(100);
    expect(env.tryAgainButton).toBeTruthy();
    env.clickButton(env.tryAgainButton);
    expect(env.recordButton).toBeTruthy();
    expect(env.uploadAudioButton).toBeTruthy();
  });

  it('correct buttons appear when source is already set', async () => {
    expect(env.recordButton).toBeTruthy();
    expect(env.uploadAudioButton).toBeTruthy();
    env.setAudioSource();
    expect(env.recordButton).toBeFalsy();
    expect(env.uploadAudioButton).toBeFalsy();
    expect(env.removeAudioButton).toBeTruthy();
  });
});

class TestEnvironment {
  readonly audioFile: string = 'test-audio-player.webm';
  readonly component: CheckingAudioCombinedComponent;
  readonly fixture: ComponentFixture<CheckingAudioCombinedComponent>;

  private readonly realtimeService = new TestRealtimeService(SF_REALTIME_DOC_TYPES);

  constructor() {
    this.fixture = TestBed.createComponent(CheckingAudioCombinedComponent);
    this.component = this.fixture.componentInstance;

    this.realtimeService.addSnapshot(UserDoc.COLLECTION, {
      id: 'user01',
      data: { name: 'user' }
    });
    when(mockedUserService.getCurrentUser()).thenCall(() =>
      this.realtimeService.subscribe(UserDoc.COLLECTION, 'user01')
    );
    this.fixture.detectChanges();
  }

  get audioBlob(): Blob {
    return getAudioBlob();
  }

  get recordButton(): DebugElement {
    return this.fixture.debugElement.query(By.css('.record'));
  }

  get removeAudioButton(): DebugElement {
    return this.fixture.debugElement.query(By.css('.remove-audio-file'));
  }
  get stopRecordingButton(): DebugElement {
    return this.fixture.debugElement.query(By.css('.stop-recording'));
  }

  get tryAgainButton(): DebugElement {
    return this.fixture.debugElement.query(By.css('.try-again'));
  }

  get uploadAudioButton(): DebugElement {
    return this.fixture.debugElement.query(By.css('.upload-audio-file'));
  }

  clickButton(button: DebugElement): void {
    button.nativeElement.click();
    this.fixture.detectChanges();
  }

  setAudioSource() {
    this.component.source = this.audioFile;
    this.fixture.detectChanges();
  }

  async waitForRecorder(ms: number) {
    await new Promise(resolve => setTimeout(resolve, ms));
    this.fixture.detectChanges();
  }
}
