import ShareDB from 'sharedb';
import { ObjProxyArg } from 'ts-object-path';
import { obj, ObjPathTemplate } from '../utils/obj-path';
import { DocService } from './doc-service';

/**
 * This is the abstract base class for all doc services that manage JSON0 docs.
 */
export abstract class JsonDocService<T> extends DocService<T> {
  /**
   * The object paths to the immutable properties in the JSON0 doc.
   */
  protected readonly immutableProps: ObjPathTemplate[] = [];

  protected pathTemplate<TField>(field?: ObjProxyArg<T, TField>, inherit: boolean = true): ObjPathTemplate {
    return obj<T>().pathTemplate(field, inherit);
  }

  protected checkImmutableProps(ops: ShareDB.Op[] | ShareDB.Op): boolean {
    if (ops instanceof Array) {
      for (const op of ops) {
        if (this.getMatchingPathTemplate(this.immutableProps, op.p) !== -1) {
          return false;
        }
      }
      return true;
    }

    return this.getMatchingPathTemplate(this.immutableProps, ops.p) === -1;
  }

  protected getMatchingPathTemplate(pathTemplates: ObjPathTemplate[], path: ShareDB.Path): number {
    for (let i = 0; i < pathTemplates.length; i++) {
      if (pathTemplates[i].matches(path)) {
        return i;
      }
    }
    return -1;
  }
}
