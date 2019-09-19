import { MdcLinearProgress } from '@angular-mdc/web';
import { DebugElement } from '@angular/core';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Params } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { ProgressStatus, RemoteTranslationEngine } from '@sillsdev/machine';
import { CheckingShareLevel } from 'realtime-server/lib/scriptureforge/models/checking-config';
import { SFProject } from 'realtime-server/lib/scriptureforge/models/sf-project';
import { SFProjectRole } from 'realtime-server/lib/scriptureforge/models/sf-project-role';
import * as RichText from 'rich-text';
import { defer, of, Subject } from 'rxjs';
import { deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { MemoryRealtimeOfflineStore } from 'xforge-common/memory-realtime-offline-store';
import { MemoryRealtimeDocAdapter } from 'xforge-common/memory-realtime-remote-store';
import { NoticeService } from 'xforge-common/notice.service';
import { UICommonModule } from 'xforge-common/ui-common.module';
import { UserService } from 'xforge-common/user.service';
import { SFProjectDoc } from '../../core/models/sf-project-doc';
import { Delta, TextDoc } from '../../core/models/text-doc';
import { TextDocId } from '../../core/models/text-doc';
import { SFProjectService } from '../../core/sf-project.service';
import { TranslateOverviewComponent } from './translate-overview.component';

describe('TranslateOverviewComponent', () => {
  describe('Progress Card', () => {
    it('should list all books in project', fakeAsync(() => {
      const env = new TestEnvironment();
      env.wait();

      expect(env.progressTitle.textContent).toContain('Progress');
      expect(env.component.texts.length).toEqual(4);
      env.expectContainsTextProgress(0, 'Matthew', '10 of 20 segments');
      env.expectContainsTextProgress(1, 'Mark', '10 of 20 segments');
      env.expectContainsTextProgress(2, 'Luke', '10 of 20 segments');
      env.expectContainsTextProgress(3, 'John', '10 of 20 segments');
    }));
  });

  describe('Engine Card', () => {
    it('should be hidden when translation suggestions disabled', fakeAsync(() => {
      const env = new TestEnvironment();
      env.setupProjectData(false);
      env.wait();

      expect(env.engineCard).toBeNull();
    }));

    it('should be hidden when user cannot edit texts', fakeAsync(() => {
      const env = new TestEnvironment();
      env.setCurrentUser('user02');
      env.setupProjectData(false);
      env.wait();

      expect(env.engineCard).toBeNull();
    }));

    it('should display engine stats', fakeAsync(() => {
      const env = new TestEnvironment();
      env.wait();

      expect(env.qualityStarIcons).toEqual(['star', 'star_half', 'star_border']);
      expect(env.segmentsCount.nativeElement.textContent).toBe('100');
    }));

    it('training progress status', fakeAsync(() => {
      const env = new TestEnvironment();
      env.wait();

      verify(env.mockedRemoteTranslationEngine.listenForTrainingStatus()).once();
      env.updateTrainingProgress(0.1);
      expect(env.trainingProgress.open).toBe(true);
      expect(env.component.isTraining).toBe(true);
      env.updateTrainingProgress(1);
      env.completeTrainingProgress();
      expect(env.trainingProgress.open).toBe(false);
      expect(env.component.isTraining).toBe(false);
      env.updateTrainingProgress(0.1);
      expect(env.trainingProgress.open).toBe(true);
      expect(env.component.isTraining).toBe(true);
    }));

    it('retrain', fakeAsync(() => {
      const env = new TestEnvironment();
      env.wait();

      verify(env.mockedRemoteTranslationEngine.listenForTrainingStatus()).once();
      env.clickRetrainButton();
      expect(env.trainingProgress.open).toBe(true);
      expect(env.trainingProgress.determinate).toBe(false);
      expect(env.component.isTraining).toBe(true);
      env.updateTrainingProgress(0.1);
      expect(env.trainingProgress.determinate).toBe(true);
    }));
  });
});

class TestEnvironment {
  readonly mockedActivatedRoute = mock(ActivatedRoute);
  readonly mockedSFProjectService = mock(SFProjectService);
  readonly mockedNoticeService = mock(NoticeService);
  readonly mockedRemoteTranslationEngine = mock(RemoteTranslationEngine);
  readonly mockedUserService = mock(UserService);

  readonly component: TranslateOverviewComponent;
  readonly fixture: ComponentFixture<TranslateOverviewComponent>;

  private readonly offlineStore = new MemoryRealtimeOfflineStore();
  private trainingProgress$ = new Subject<ProgressStatus>();

  constructor() {
    const params = { ['projectId']: 'project01' } as Params;
    when(this.mockedActivatedRoute.params).thenReturn(of(params));
    when(this.mockedSFProjectService.createTranslationEngine('project01')).thenReturn(
      instance(this.mockedRemoteTranslationEngine)
    );
    when(this.mockedRemoteTranslationEngine.getStats()).thenResolve({ confidence: 0.25, trainedSegmentCount: 100 });
    when(this.mockedRemoteTranslationEngine.listenForTrainingStatus()).thenReturn(defer(() => this.trainingProgress$));
    this.setCurrentUser();
    TestBed.configureTestingModule({
      declarations: [TranslateOverviewComponent],
      imports: [RouterTestingModule, UICommonModule],
      providers: [
        { provide: ActivatedRoute, useFactory: () => instance(this.mockedActivatedRoute) },
        { provide: SFProjectService, useFactory: () => instance(this.mockedSFProjectService) },
        { provide: NoticeService, useFactory: () => instance(this.mockedNoticeService) },
        { provide: UserService, useFactory: () => instance(this.mockedUserService) }
      ]
    });

    this.fixture = TestBed.createComponent(TranslateOverviewComponent);
    this.component = this.fixture.componentInstance;
    this.setupProjectData();
  }

  get progressTextList(): HTMLElement {
    return this.fixture.nativeElement.querySelector('mdc-list');
  }

  get progressTitle(): HTMLElement {
    return this.fixture.nativeElement.querySelector('#translate-overview-title');
  }

  get qualityStars(): DebugElement {
    return this.fixture.debugElement.query(By.css('.engine-card-quality-stars'));
  }

  get qualityStarIcons(): string[] {
    const stars = this.qualityStars.queryAll(By.css('mdc-icon'));
    return stars.map(s => s.nativeElement.textContent);
  }

  get segmentsCount(): DebugElement {
    return this.fixture.debugElement.query(By.css('.engine-card-segments-count'));
  }

  get trainingProgress(): MdcLinearProgress {
    return this.fixture.debugElement.query(By.css('#training-progress')).componentInstance;
  }

  get retrainButton(): DebugElement {
    return this.fixture.debugElement.query(By.css('#retrain-button'));
  }

  get engineCard(): DebugElement {
    return this.fixture.debugElement.query(By.css('.engine-card'));
  }

  setCurrentUser(userId: string = 'user01'): void {
    when(this.mockedUserService.currentUserId).thenReturn(userId);
  }

  wait(): void {
    this.fixture.detectChanges();
    tick();
    this.fixture.detectChanges();
  }

  expectContainsTextProgress(index: number, primary: string, secondary: string): void {
    const items = this.progressTextList.querySelectorAll('mdc-list-item');
    const item = items.item(index);
    const primaryElem = item.querySelector('.mdc-list-item__primary-text');
    expect(primaryElem.textContent).toBe(primary);
    const secondaryElem = item.querySelector('.mdc-list-item__secondary-text');
    expect(secondaryElem.textContent).toBe(secondary);
  }

  setupProjectData(translationSuggestionsEnabled: boolean = true): void {
    const project: SFProject = {
      name: 'project 01',
      paratextId: 'pt01',
      shortName: 'P01',
      writingSystem: {
        tag: 'qaa'
      },
      translateConfig: {
        translationSuggestionsEnabled
      },
      checkingConfig: {
        checkingEnabled: false,
        usersSeeEachOthersResponses: true,
        shareEnabled: true,
        shareLevel: CheckingShareLevel.Specific
      },
      sync: { queuedCount: 0 },
      userRoles: {
        user01: SFProjectRole.ParatextTranslator,
        user02: SFProjectRole.ParatextConsultant
      },
      texts: [
        {
          bookNum: 40,
          chapters: [{ number: 1, lastVerse: 3 }, { number: 2, lastVerse: 3 }],
          hasSource: true
        },
        {
          bookNum: 41,
          chapters: [{ number: 1, lastVerse: 3 }, { number: 2, lastVerse: 3 }],
          hasSource: true
        },
        {
          bookNum: 42,
          chapters: [{ number: 1, lastVerse: 3 }, { number: 2, lastVerse: 3 }],
          hasSource: true
        },
        {
          bookNum: 43,
          chapters: [{ number: 1, lastVerse: 3 }, { number: 2, lastVerse: 3 }],
          hasSource: false
        }
      ]
    };
    const adapter = new MemoryRealtimeDocAdapter(SFProjectDoc.COLLECTION, 'project01', project);
    const doc = new SFProjectDoc(this.offlineStore, adapter);
    when(this.mockedSFProjectService.get('project01')).thenResolve(doc);

    this.addTextDoc(new TextDocId('project01', 40, 1, 'target'));
    this.addTextDoc(new TextDocId('project01', 40, 2, 'target'));
    this.addTextDoc(new TextDocId('project01', 41, 1, 'target'));
    this.addTextDoc(new TextDocId('project01', 41, 2, 'target'));
    this.addTextDoc(new TextDocId('project01', 42, 1, 'target'));
    this.addTextDoc(new TextDocId('project01', 42, 2, 'target'));
    this.addTextDoc(new TextDocId('project01', 43, 1, 'target'));
    this.addTextDoc(new TextDocId('project01', 43, 2, 'target'));
  }

  updateTrainingProgress(percentCompleted: number): void {
    this.trainingProgress$.next({ percentCompleted, message: 'message' });
    this.fixture.detectChanges();
  }

  completeTrainingProgress(): void {
    const trainingProgress$ = this.trainingProgress$;
    this.trainingProgress$ = new Subject<ProgressStatus>();
    trainingProgress$.complete();
    this.fixture.detectChanges();
    tick();
  }

  clickRetrainButton(): void {
    this.retrainButton.nativeElement.click();
    this.fixture.detectChanges();
  }

  private addTextDoc(id: TextDocId): void {
    when(this.mockedSFProjectService.getText(deepEqual(id))).thenResolve(this.createTextDoc(id));
  }

  private createTextDoc(id: TextDocId): TextDoc {
    const delta = new Delta();
    delta.insert({ chapter: { number: id.chapterNum.toString(), style: 'c' } });
    delta.insert({ verse: { number: '1', style: 'v' } });
    delta.insert(`chapter ${id.chapterNum}, verse 1.`, { segment: `verse_${id.chapterNum}_1` });
    delta.insert({ verse: { number: '2', style: 'v' } });
    delta.insert({ blank: 'normal' }, { segment: `verse_${id.chapterNum}_2` });
    delta.insert({ verse: { number: '3', style: 'v' } });
    delta.insert(`chapter ${id.chapterNum}, verse 3.`, { segment: `verse_${id.chapterNum}_3` });
    delta.insert({ verse: { number: '4', style: 'v' } });
    delta.insert({ blank: 'normal' }, { segment: `verse_${id.chapterNum}_4` });
    delta.insert({ verse: { number: '5', style: 'v' } });
    delta.insert(`chapter ${id.chapterNum}, verse 5.`, { segment: `verse_${id.chapterNum}_5` });
    delta.insert({ verse: { number: '6', style: 'v' } });
    delta.insert({ blank: 'normal' }, { segment: `verse_${id.chapterNum}_6` });
    delta.insert({ verse: { number: '7', style: 'v' } });
    delta.insert(`chapter ${id.chapterNum}, verse 7.`, { segment: `verse_${id.chapterNum}_7` });
    delta.insert({ verse: { number: '8', style: 'v' } });
    delta.insert({ blank: 'normal' }, { segment: `verse_${id.chapterNum}_8` });
    delta.insert({ verse: { number: '9', style: 'v' } });
    delta.insert(`chapter ${id.chapterNum}, verse 9.`, { segment: `verse_${id.chapterNum}_9` });
    delta.insert({ verse: { number: '10', style: 'v' } });
    delta.insert({ blank: 'normal' }, { segment: `verse_${id.chapterNum}_10` });
    delta.insert('\n', { para: { style: 'p' } });
    const adapter = new MemoryRealtimeDocAdapter(TextDoc.COLLECTION, id.toString(), delta, RichText.type);
    return new TextDoc(this.offlineStore, adapter);
  }
}
