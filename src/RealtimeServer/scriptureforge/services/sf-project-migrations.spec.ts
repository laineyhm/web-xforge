import ShareDB = require('sharedb');
import ShareDBMingo = require('sharedb-mingo-memory');
import { instance, mock, when } from 'ts-mockito';
import { MetadataDB } from '../../common/metadata-db';
import { RealtimeServer } from '../../common/realtime-server';
import { SchemaVersionRepository } from '../../common/schema-version-repository';
import { createDoc, fetchDoc } from '../../common/utils/test-utils';
import { SF_PROJECTS_COLLECTION } from '../models/sf-project';
import { SFProjectService } from './sf-project-service';

describe('SFProjectMigrations', () => {
  describe('version 1', () => {
    it('migrates docs', async () => {
      const env = new TestEnvironment(0);
      const conn = env.server.connect();
      await createDoc(conn, SF_PROJECTS_COLLECTION, 'project01', {
        texts: [
          { bookNum: 40, chapters: [{ number: 1 }, { number: 2, isValid: true }] },
          { bookNum: 41, chapters: [{ number: 1 }, { number: 2 }] }
        ]
      });
      await env.server.migrateIfNecessary();

      const projectDoc = await fetchDoc(conn, SF_PROJECTS_COLLECTION, 'project01');
      expect(projectDoc.data.texts[0].chapters[0].isValid).toBe(true);
      expect(projectDoc.data.texts[0].chapters[1].isValid).toBe(true);
      expect(projectDoc.data.texts[1].chapters[0].isValid).toBe(true);
      expect(projectDoc.data.texts[1].chapters[1].isValid).toBe(true);
    });
  });
});

class TestEnvironment {
  readonly db: ShareDBMingo;
  readonly mockedSchemaVersionRepository = mock(SchemaVersionRepository);
  readonly server: RealtimeServer;

  constructor(version: number) {
    const ShareDBMingoType = MetadataDB(ShareDBMingo.extendMemoryDB(ShareDB.MemoryDB));
    this.db = new ShareDBMingoType();
    when(this.mockedSchemaVersionRepository.getAll()).thenResolve([
      { _id: SF_PROJECTS_COLLECTION, collection: SF_PROJECTS_COLLECTION, version }
    ]);
    this.server = new RealtimeServer(
      [new SFProjectService()],
      SF_PROJECTS_COLLECTION,
      this.db,
      instance(this.mockedSchemaVersionRepository)
    );
  }
}