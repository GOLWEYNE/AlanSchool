// Helper functions for creating Word document downloads
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';

interface ExamDocument {
  title: string;
  subject: string;
  className: string;
  dueDate: Date;
  duration: number; // in minutes
  instructions?: string;
  totalMarks?: number;
  questions?: ExamQuestion[];
}

interface ExamQuestion {
  number: number;
  question: string;
  marks: number;
}

export const createExamDocument = async (exam: ExamDocument): Promise<Blob> => {
  const sections = [
    // Header
    new Paragraph({
      text: "ALAN INTERNATIONAL SCHOOL",
      bold: true,
      size: 28,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      text: exam.subject + " Examination",
      bold: true,
      size: 24,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),

    // Exam Details
    new Table({
      rows: [
        new TableRow({
          cells: [
            new TableCell({
              children: [new Paragraph({ text: "Subject:", bold: true })],
            }),
            new TableCell({
              children: [new Paragraph({ text: exam.subject })],
            }),
          ],
        }),
        new TableRow({
          cells: [
            new TableCell({
              children: [new Paragraph({ text: "Class:", bold: true })],
            }),
            new TableCell({
              children: [new Paragraph({ text: exam.className })],
            }),
          ],
        }),
        new TableRow({
          cells: [
            new TableCell({
              children: [new Paragraph({ text: "Duration:", bold: true })],
            }),
            new TableCell({
              children: [new Paragraph({ text: `${exam.duration} minutes` })],
            }),
          ],
        }),
        new TableRow({
          cells: [
            new TableCell({
              children: [new Paragraph({ text: "Due Date:", bold: true })],
            }),
            new TableCell({
              children: [new Paragraph({ text: exam.dueDate.toLocaleDateString() })],
            }),
          ],
        }),
        new TableRow({
          cells: [
            new TableCell({
              children: [new Paragraph({ text: "Total Marks:", bold: true })],
            }),
            new TableCell({
              children: [new Paragraph({ text: String(exam.totalMarks || 0) })],
            }),
          ],
        }),
      ],
    }),

    new Paragraph({ text: "", spacing: { after: 400 } }),

    // Instructions
    new Paragraph({
      text: "Instructions:",
      bold: true,
      size: 22,
    }),
    new Paragraph({
      text: exam.instructions || "Please answer all questions carefully. Manage your time wisely.",
      spacing: { after: 400 },
    }),

    // Questions
    new Paragraph({
      text: "Questions:",
      bold: true,
      size: 22,
    }),
    ...(exam.questions?.map(
      (q) =>
        new Paragraph({
          text: `${q.number}. ${q.question} [${q.marks} marks]",
          spacing: { after: 200, before: 100 },
        })
    ) || []),

    new Paragraph({ text: "", spacing: { after: 600 } }),

    new Paragraph({
      text: "---\nEnd of Examination\n---",
      alignment: AlignmentType.CENTER,
      italics: true,
    }),
  ];

  const doc = new Document({
    sections: [
      {
        children: sections,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return blob;
};

export const downloadExamAsWord = async (exam: ExamDocument) => {
  const blob = await createExamDocument(exam);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${exam.subject}_${new Date().toISOString().split('T')[0]}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
