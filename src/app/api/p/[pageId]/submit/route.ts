import { NextRequest, NextResponse } from 'next/server';
import { getPage, saveSubmission } from '@/lib/db/pages';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await params;
    const body = await request.json();

    // Fetch page config
    const page = await getPage(pageId);
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // Check deadline
    if (page.settings.deadline) {
      const deadline = new Date(page.settings.deadline);
      if (new Date() > deadline) {
        return NextResponse.json(
          { error: 'This form is no longer accepting submissions.' },
          { status: 410 }
        );
      }
    }

    // Check max responses
    if (page.settings.maxResponses && page.submissions >= page.settings.maxResponses) {
      return NextResponse.json(
        { error: 'Maximum number of responses reached.' },
        { status: 410 }
      );
    }

    // Handle check-in type
    if (page.type === 'checkin') {
      const code = body.code;
      if (!code) {
        return NextResponse.json({ error: 'Ticket code is required' }, { status: 400 });
      }

      // Save the check-in record
      await saveSubmission(pageId, {
        action: 'checkin',
        code,
        checkedInAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: `Checked in successfully with code: ${code}`,
      });
    }

    // Validate required fields
    const missingFields: string[] = [];
    for (const field of page.fields) {
      if (field.required) {
        const value = body[field.name];
        if (value === undefined || value === null || value === '') {
          missingFields.push(field.label);
        }
      }
    }

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Required fields missing: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate email fields
    for (const field of page.fields) {
      if (field.type === 'email' && body[field.name]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(body[field.name])) {
          return NextResponse.json(
            { error: `Invalid email address for ${field.label}` },
            { status: 400 }
          );
        }
      }
    }

    // Save submission
    const submission = await saveSubmission(pageId, {
      ...body,
      _pageType: page.type,
      _submittedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      message: page.settings.successMessage || 'Submission received!',
    });
  } catch (error) {
    console.error('Submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
