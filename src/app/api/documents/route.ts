import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return notFound();
  }

  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type"); // "quiz", "exam", "assignment"
    const title = url.searchParams.get("title");
    const subject = url.searchParams.get("subject");

    let content = "";

    if (type === "quiz") {
      content = `
ALAN INTERNATIONAL SCHOOL
QUIZ - ${subject}

Title: ${title}
Date: ${new Date().toLocaleDateString()}

Instructions:
1. Answer all questions carefully
2. Show your working for calculations
3. Manage your time wisely
4. Submit before the due date

Questions:
[Add your quiz questions here]
      `;
    } else if (type === "exam") {
      content = `
ALAN INTERNATIONAL SCHOOL
EXAMINATION - ${subject}

Title: ${title}
Date: ${new Date().toLocaleDateString()}

Instructions:
1. Read all questions carefully
2. You have the specified duration to complete the exam
3. Answer all questions
4. Show all your working for calculations
5. Manage your time wisely
6. Submit your completed exam before time runs out

Exam Details:
[Exam questions and sections go here]
      `;
    } else if (type === "assignment") {
      content = `
ALAN INTERNATIONAL SCHOOL
ASSIGNMENT - ${subject}

Title: ${title}
Date: ${new Date().toLocaleDateString()}

Instructions:
1. Complete all assigned work
2. Submit through the assignment portal before the due date
3. Late submissions will be marked as late
4. Follow the format provided by your teacher
5. Include your name and class on the submission

Assignment Details:
[Assignment instructions and requirements go here]

Grading Criteria:
- Completeness (30%)
- Accuracy (40%)
- Presentation (30%)
      `;
    }

    const buffer = Buffer.from(content, "utf-8");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${title || type}_${new Date().toISOString().split("T")[0]}.docx"`,
      },
    });
  } catch (error) {
    return new NextResponse(
      JSON.stringify({ error: "Failed to generate document" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
