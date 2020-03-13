﻿using System;
using System.Collections.Generic;
using Paratext.Data;
using Paratext.Data.ProjectFileAccess;
using Paratext.Data.ProjectSettingsAccess;
using SIL.Scripture;
using NSubstitute;
using Paratext.Data.Languages;
using PtxUtils;
using SIL.WritingSystems;

// TODO: Copied from PT vcs. Ok?   Then modified :)

namespace Paratext.Base
{
    /// <summary>
    /// Mock which stored text data in keys such as "GEN" or "GEN 3"
    /// </summary>
    public class MockScrText : ScrText
    {


        public MockScrText()
        {
            _settings = new MockProjectSettings(this);
            _language = new MockScrLanguage(this);
        }

        public Dictionary<string, string> Data = new Dictionary<string, string>();


        /// <summary>
        /// Return text of specified chapter or book.
        /// Returns "" if the chapter or book is not found or chapterization problem
        /// </summary>
        /// <param name="vref">Specify book or chapter. Verse number is ignored.</param>
        /// <param name="singleChapter">True to get a single chapter.</param>
        /// <param name="doMapIn">true to do mapping (normally true)</param>
        /// <returns>Text of book or chapter</returns>
        public override string GetText(VerseRef vref, bool singleChapter, bool doMapIn)
        {
            string usfm;
            if (Data.TryGetValue(singleChapter ? vref.Book + " " + vref.Chapter : vref.Book, out usfm))
                return usfm;
            return "";
        }

        protected override ProjectFileManager CreateFileManager()
        {
            _fileManager = Substitute.For<ProjectFileManager>(this, null);
            return _fileManager;
        }

        public ProjectSettings _settings;
        public override ProjectSettings Settings => _settings;
        public override ScrStylesheet DefaultStylesheet => new MockScrStylesheet("/home/vagrant/src/web-xforge/src/SIL.XForge.Scripture/usfm.sty");
        public override string Directory => "/tmp/xForge_testing";
        public override string Name => "PTNAME";
        public override ScrLanguage Language => _language;
        public ProjectFileManager _fileManager;
        private ScrLanguage _language;
    }

    /// <summary>
    /// Replaces a ScrLanguage for use in testing. Does not use the file system to save/load data.
    /// </summary>
    class MockScrLanguage : ScrLanguage
    {
        internal MockScrLanguage(ScrText scrText) : base(null, ProjectNormalization.Undefined, scrText)
        {
        }

        protected override WritingSystemDefinition LoadWsDef(ScrText scrText)
        {
            // Don't load anything from disk for testing and just return the one we already have
            return wsDef;
        }
    }
}
