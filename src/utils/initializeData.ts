import { projectId, publicAnonKey } from './supabase/info.tsx';

export async function initializeDefaultData() {
  try {
    // Check if pages already exist
    const pagesResponse = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages`,
      {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      }
    );

    const pagesData = await pagesResponse.json();
    
    // If pages exist, don't initialize
    if (pagesData.pages && pagesData.pages.length > 0) {
      return;
    }

    // Create default introduction page
    const introPage = {
      slug: 'introduction',
      title: 'Introduction',
      description: 'Welcome to VividBooks documentation',
      content: `# Welcome to VividBooks

VividBooks is a powerful platform for creating, managing, and sharing interactive digital books. This documentation will guide you through all the features and capabilities of VividBooks.

## What is VividBooks?

VividBooks enables you to create beautiful, interactive digital books with ease. Whether you're writing a novel, creating educational content, or building a knowledge base, VividBooks provides all the tools you need.

## Key Features

- **Rich Text Editor** - Write and format your content with an intuitive editor
- **Interactive Elements** - Add videos, images, and interactive components
- **Collaboration** - Work together with other authors in real-time
- **Publishing** - Publish your books with a single click
- **Analytics** - Track reader engagement and behavior

## Getting Started

Ready to create your first book? Start by exploring the topics in the sidebar:

1. **Getting Started** - Set up your account and create your first book
2. **Writing & Editing** - Learn how to write and format your content
3. **Publishing** - Make your book available to readers
4. **Advanced Features** - Discover powerful features for creating engaging content

Let's get started!
`,
      order: 0
    };

    // Note: We can't create the page without authentication
    // Users will need to sign up and create their first page manually
    console.log('Default data would be created if authenticated');
  } catch (error) {
    console.error('Error initializing data:', error);
  }
}
