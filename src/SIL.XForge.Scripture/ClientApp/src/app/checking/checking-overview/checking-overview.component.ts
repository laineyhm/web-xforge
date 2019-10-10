import { MdcDialog, MdcDialogConfig, MdcDialogRef } from '@angular-mdc/web';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { distanceInWordsToNow } from 'date-fns';
import { Question } from 'realtime-server/lib/scriptureforge/models/question';
import { SFProjectRole } from 'realtime-server/lib/scriptureforge/models/sf-project-role';
import { getTextDocId } from 'realtime-server/lib/scriptureforge/models/text-data';
import { TextInfo } from 'realtime-server/lib/scriptureforge/models/text-info';
import { fromVerseRef } from 'realtime-server/lib/scriptureforge/models/verse-ref-data';
import { Canon } from 'realtime-server/lib/scriptureforge/scripture-utils/canon';
import { merge, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { DataLoadingComponent } from 'xforge-common/data-loading-component';
import { RealtimeQuery } from 'xforge-common/models/realtime-query';
import { NoticeService } from 'xforge-common/notice.service';
import { UserService } from 'xforge-common/user.service';
import { objectId } from 'xforge-common/utils';
import { QuestionDoc } from '../../core/models/question-doc';
import { SFProjectDoc } from '../../core/models/sf-project-doc';
import { SFProjectUserConfigDoc } from '../../core/models/sf-project-user-config-doc';
import { TextDocId } from '../../core/models/text-doc';
import { TextsByBookId } from '../../core/models/texts-by-book-id';
import { SFProjectService } from '../../core/sf-project.service';
import { CheckingUtils } from '../checking.utils';
import { QuestionAnsweredDialogComponent } from '../question-answered-dialog/question-answered-dialog.component';
import {
  QuestionDialogComponent,
  QuestionDialogData,
  QuestionDialogResult
} from '../question-dialog/question-dialog.component';

@Component({
  selector: 'app-checking-overview',
  templateUrl: './checking-overview.component.html',
  styleUrls: ['./checking-overview.component.scss']
})
export class CheckingOverviewComponent extends DataLoadingComponent implements OnInit, OnDestroy {
  itemVisible: { [bookIdOrDocId: string]: boolean } = {};
  itemVisibleArchived: { [bookIdOrDocId: string]: boolean } = {};
  questionDocs: { [docId: string]: QuestionDoc[] } = {};
  texts: TextInfo[] = [];
  projectId?: string;

  private textsByBookId: TextsByBookId = {};
  private projectDoc?: SFProjectDoc;
  private dataChangesSub?: Subscription;
  private projectUserConfigDoc?: SFProjectUserConfigDoc;
  private questionsQuery?: RealtimeQuery<QuestionDoc>;

  constructor(
    private readonly activatedRoute: ActivatedRoute,
    private readonly dialog: MdcDialog,
    noticeService: NoticeService,
    private readonly projectService: SFProjectService,
    private readonly userService: UserService
  ) {
    super(noticeService);
  }

  get allQuestionsCount(): string {
    if (this.questionDocs == null) {
      return '-';
    }

    return '' + this.allPublishedQuestions.length;
  }

  get myAnswerCount(): string {
    if (this.questionDocs == null) {
      return '-';
    }

    let count: number = 0;
    for (const questionDoc of this.allPublishedQuestions) {
      if (questionDoc.data != null) {
        if (this.isProjectAdmin) {
          count += questionDoc.data.answers.length;
        } else {
          count += questionDoc.data.answers.filter(a => a.ownerRef === this.userService.currentUserId).length;
        }
      }
    }

    return '' + count;
  }

  get myLikeCount(): string {
    if (this.questionDocs == null) {
      return '-';
    }

    let count: number = 0;
    for (const questionDoc of this.allPublishedQuestions) {
      if (questionDoc.data != null) {
        for (const answer of questionDoc.data.answers) {
          if (this.isProjectAdmin) {
            count += answer.likes.length;
          } else {
            count += answer.likes.filter(l => l.ownerRef === this.userService.currentUserId).length;
          }
        }
      }
    }

    return '' + count;
  }

  get myCommentCount(): string {
    if (this.questionDocs == null) {
      return '-';
    }

    let count: number = 0;
    for (const questionDoc of this.allPublishedQuestions) {
      if (questionDoc.data != null) {
        for (const answer of questionDoc.data.answers) {
          if (this.isProjectAdmin) {
            count += answer.comments.length;
          } else {
            count += answer.comments.filter(c => c.ownerRef === this.userService.currentUserId).length;
          }
        }
      }
    }

    return '' + count;
  }

  get canSeeOtherUserResponses(): boolean {
    return (
      this.projectDoc != null &&
      this.projectDoc.data != null &&
      this.projectDoc.data.checkingConfig.usersSeeEachOthersResponses
    );
  }

  get isProjectAdmin(): boolean {
    return (
      this.projectDoc != null &&
      this.projectDoc.data != null &&
      this.projectDoc.data.userRoles[this.userService.currentUserId] === SFProjectRole.ParatextAdministrator
    );
  }

  get allArchivedQuestionsCount(): number {
    if (this.questionsQuery == null) {
      return 0;
    }
    return this.questionsQuery.docs.filter(qd => qd.data != null && qd.data.isArchived).length;
  }

  private get allPublishedQuestions(): QuestionDoc[] {
    if (this.questionsQuery == null) {
      return [];
    }
    return this.questionsQuery.docs.filter(qd => qd.data != null && !qd.data.isArchived);
  }

  ngOnInit(): void {
    this.subscribe(this.activatedRoute.params.pipe(map(params => params['projectId'])), async projectId => {
      this.loadingStarted();
      this.projectId = projectId;
      try {
        this.projectDoc = await this.projectService.get(projectId);
        this.projectUserConfigDoc = await this.projectService.getUserConfig(projectId, this.userService.currentUserId);
        if (this.questionsQuery != null) {
          this.questionsQuery.dispose();
        }
        this.questionsQuery = await this.projectService.queryQuestions(projectId);
        this.initTexts();
      } finally {
        this.loadingFinished();
      }

      if (this.dataChangesSub != null) {
        this.dataChangesSub.unsubscribe();
      }
      this.dataChangesSub = merge(this.projectDoc.remoteChanges$, this.questionsQuery.remoteChanges$).subscribe(() => {
        this.loadingStarted();
        try {
          this.initTexts();
        } finally {
          this.loadingFinished();
        }
      });
    });
  }

  ngOnDestroy(): void {
    super.ngOnDestroy();
    if (this.dataChangesSub != null) {
      this.dataChangesSub.unsubscribe();
    }
    if (this.questionsQuery != null) {
      this.questionsQuery.dispose();
    }
  }

  getTextDocId(bookNum: number, chapter: number): string {
    if (this.projectDoc == null) {
      return '';
    }
    return getTextDocId(this.projectDoc.id, bookNum, chapter);
  }

  getQuestionDocs(textDocId: TextDocId, fromArchive = false): QuestionDoc[] {
    if (fromArchive) {
      return this.questionDocs[textDocId.toString()].filter(qd => qd.data != null && qd.data.isArchived);
    }
    return this.questionDocs[textDocId.toString()].filter(qd => qd.data != null && !qd.data.isArchived);
  }

  bookQuestionCount(text: TextInfo, fromArchive = false): number {
    let count: number = 0;
    for (const chapter of text.chapters) {
      const questionCount = this.questionCount(text.bookNum, chapter.number, fromArchive);
      count += questionCount;
    }
    return count;
  }

  dateInWords(date: string): string {
    return distanceInWordsToNow(new Date(date));
  }

  questionCount(bookNum: number, chapterNumber: number, fromArchive = false): number {
    if (this.projectDoc == null) {
      return 0;
    }
    const id = new TextDocId(this.projectDoc.id, bookNum, chapterNumber);
    if (!(id.toString() in this.questionDocs)) {
      return 0;
    }
    if (fromArchive) {
      return this.questionDocs[id.toString()].filter(qd => qd.data != null && qd.data.isArchived).length;
    }
    return this.questionDocs[id.toString()].filter(qd => qd.data != null && !qd.data.isArchived).length;
  }

  questionCountLabel(count: number): string {
    return count > 0 ? count + ' questions' : '';
  }

  bookAnswerCount(text: TextInfo): number {
    let count: number = 0;
    for (const chapter of text.chapters) {
      const answerCount = this.chapterAnswerCount(text.bookNum, chapter.number);
      count += answerCount;
    }
    return count;
  }

  chapterAnswerCount(bookNum: number, chapterNumber: number): number {
    if (this.projectDoc == null) {
      return 0;
    }
    const id = new TextDocId(this.projectDoc.id, bookNum, chapterNumber);
    if (!(id.toString() in this.questionDocs)) {
      return 0;
    }

    let count: number = 0;
    for (const q of this.getQuestionDocs(id)) {
      if (q.data != null) {
        const answerCount = q.data.answers.length;
        count += answerCount;
      }
    }

    return count;
  }

  answerCountLabel(count?: number): string {
    return count != null && count > 0 ? count + ' answers' : '';
  }

  setQuestionArchiveStatus(questionDoc: QuestionDoc, archiveStatus: boolean) {
    questionDoc.submitJson0Op(op => {
      op.set(q => q.isArchived, archiveStatus);
      if (archiveStatus) {
        op.set(q => q.dateArchived!, new Date().toJSON());
      } else {
        op.unset(q => q.dateArchived!);
      }
    });
  }

  overallProgress(): number[] {
    let totalUnread: number = 0;
    let totalRead: number = 0;
    let totalAnswered: number = 0;
    for (const text of this.texts) {
      const [unread, read, answered] = this.bookProgress(text);
      totalUnread += unread;
      totalRead += read;
      totalAnswered += answered;
    }

    return [totalUnread, totalRead, totalAnswered];
  }

  bookProgress(text: TextInfo): number[] {
    let unread: number = 0;
    let read: number = 0;
    let answered: number = 0;
    if (this.projectId != null) {
      for (const chapter of text.chapters) {
        const id = new TextDocId(this.projectId, text.bookNum, chapter.number);
        if (!(id.toString() in this.questionDocs)) {
          continue;
        }

        for (const questionDoc of this.getQuestionDocs(id)) {
          if (CheckingUtils.hasUserAnswered(questionDoc.data, this.userService.currentUserId)) {
            answered++;
          } else if (
            this.projectUserConfigDoc != null &&
            CheckingUtils.hasUserReadQuestion(questionDoc.data, this.projectUserConfigDoc.data)
          ) {
            read++;
          } else {
            unread++;
          }
        }
      }
    }
    return [unread, read, answered];
  }

  async questionDialog(questionDoc?: QuestionDoc): Promise<void> {
    if (this.projectDoc == null) {
      return;
    }
    if (questionDoc != null && questionDoc.data != null) {
      if (questionDoc.data.answers.length > 0) {
        const answeredDialogRef = this.dialog.open(QuestionAnsweredDialogComponent);
        const response = (await answeredDialogRef.afterClosed().toPromise()) as string;
        if (response === 'close') {
          return;
        }
      }
    }
    const dialogConfig: MdcDialogConfig<QuestionDialogData> = {
      data: {
        question: questionDoc != null ? questionDoc.data : undefined,
        textsByBookId: this.textsByBookId,
        projectId: this.projectDoc.id
      }
    };
    const dialogRef = this.dialog.open(QuestionDialogComponent, dialogConfig) as MdcDialogRef<
      QuestionDialogComponent,
      QuestionDialogResult | 'close'
    >;

    dialogRef.afterClosed().subscribe(async result => {
      if (result == null || result === 'close' || this.projectId == null) {
        return;
      }
      const questionId = questionDoc != null && questionDoc.data != null ? questionDoc.data.dataId : objectId();
      const verseRefData = fromVerseRef(result.verseRef);
      const text = result.text;
      let audioUrl = questionDoc != null && questionDoc.data != null ? questionDoc.data.audioUrl : undefined;
      if (result.audio.fileName && result.audio.blob != null) {
        const response = await this.projectService.onlineUploadAudio(
          this.projectId,
          questionId,
          new File([result.audio.blob], result.audio.fileName)
        );
        // Get the amended filename and save it against the answer
        audioUrl = response;
      } else if (result.audio.status === 'reset') {
        audioUrl = undefined;
      }

      const currentDate = new Date().toJSON();
      if (questionDoc != null && questionDoc.data != null) {
        const deleteAudio = questionDoc.data.audioUrl != null && audioUrl == null;
        const oldVerseRef = questionDoc.data.verseRef;
        const moveToDifferentChapter =
          oldVerseRef.bookNum !== verseRefData.bookNum || oldVerseRef.chapterNum !== verseRefData.chapterNum;
        if (moveToDifferentChapter) {
          this.removeQuestionDoc(questionDoc);
        }
        await questionDoc.submitJson0Op(op =>
          op
            .set(q => q.verseRef, verseRefData)
            .set(q => q.text!, text)
            .set(q => q.audioUrl, audioUrl)
            .set(q => q.dateModified, currentDate)
        );
        if (deleteAudio) {
          await this.projectService.onlineDeleteAudio(
            this.projectId,
            questionDoc.data.dataId,
            questionDoc.data.ownerRef
          );
        }
        if (moveToDifferentChapter) {
          this.addQuestionDoc(questionDoc);
        }
      } else {
        const newQuestion: Question = {
          dataId: questionId,
          projectRef: this.projectId,
          ownerRef: this.userService.currentUserId,
          verseRef: verseRefData,
          text,
          audioUrl,
          answers: [],
          isArchived: false,
          dateCreated: currentDate,
          dateModified: currentDate
        };
        questionDoc = await this.projectService.createQuestion(this.projectId, newQuestion);
        this.addQuestionDoc(questionDoc);
      }
    });
  }

  getBookName(text: TextInfo): string {
    return Canon.bookNumberToEnglishName(text.bookNum);
  }

  getBookId(text: TextInfo): string {
    return Canon.bookNumberToId(text.bookNum);
  }

  private initTexts(): void {
    if (this.projectDoc == null || this.projectDoc.data == null || this.questionsQuery == null) {
      return;
    }

    this.questionDocs = {};
    this.textsByBookId = {};
    this.texts = [];
    for (const text of this.projectDoc.data.texts) {
      // ignore empty books
      if (text.chapters.length === 1 && text.chapters[0].lastVerse === 0) {
        continue;
      }
      this.textsByBookId[Canon.bookNumberToId(text.bookNum)] = text;
      this.texts.push(text);
      for (const chapter of text.chapters) {
        const textId = new TextDocId(this.projectDoc.id, text.bookNum, chapter.number);
        this.questionDocs[textId.toString()] = [];
      }
    }

    for (const questionDoc of this.questionsQuery.docs) {
      this.addQuestionDoc(questionDoc);
    }
  }

  private addQuestionDoc(questionDoc: QuestionDoc): void {
    if (this.projectDoc == null || questionDoc.data == null) {
      return;
    }
    const textId = new TextDocId(
      this.projectDoc.id,
      questionDoc.data.verseRef.bookNum,
      questionDoc.data.verseRef.chapterNum
    );
    this.questionDocs[textId.toString()].push(questionDoc);
  }

  private removeQuestionDoc(questionDoc: QuestionDoc): void {
    if (this.projectDoc == null || questionDoc.data == null) {
      return;
    }
    const textId = new TextDocId(
      this.projectDoc.id,
      questionDoc.data.verseRef.bookNum,
      questionDoc.data.verseRef.chapterNum
    );
    const chapterQuestionDocs = this.questionDocs[textId.toString()];
    const index = chapterQuestionDocs.indexOf(questionDoc);
    chapterQuestionDocs.splice(index, 1);
  }
}
