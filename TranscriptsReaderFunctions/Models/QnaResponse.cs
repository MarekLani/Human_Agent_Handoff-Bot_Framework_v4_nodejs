using System;
using System.Collections.Generic;
using System.Text;

namespace AskAdamFunctions.Models
{
    public class QnaResponse
    {
        public List<Answer> answers { get; set; }
        public object debugInfo { get; set; }
        public bool activeLearningEnabled { get; set; }
    }

    public class Metadata
    {
        public string name { get; set; }
        public string value { get; set; }
    }

    public class Prompt
    {
        public int displayOrder { get; set; }
        public int qnaId { get; set; }
        public object qna { get; set; }
        public string displayText { get; set; }
    }

    public class Context
    {
        public bool isContextOnly { get; set; }
        public List<Prompt> prompts { get; set; }
    }

    public class Answer
    {
        public List<string> questions { get; set; }
        public string answer { get; set; }
        public double score { get; set; }
        public int id { get; set; }
        public string source { get; set; }
        public List<Metadata> metadata { get; set; }
        public Context context { get; set; }
    }
}
