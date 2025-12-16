import { Link } from 'react-router-dom';
import { FileText, Search, Moon, Sun, Settings, Lock } from 'lucide-react';

interface WelcomePageProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export function WelcomePage({ theme, toggleTheme }: WelcomePageProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center px-4 gap-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-pink-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">VB</span>
            </div>
            <span className="font-semibold">Vividbooks návody a metodika</span>
          </Link>

          <div className="flex-1 flex items-center justify-end gap-2">
            <Link
              to="/admin/login"
              className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent rounded-md transition-colors"
            >
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">Admin Login</span>
            </Link>

            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-accent rounded-md transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-16 max-w-5xl">
        <div className="text-center mb-16">
          <h1 className="mb-4">
            Vividbooks návody a metodika
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Naučte se používat Vividbooks k vytváření, správě a sdílení digitálních knih
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link
              to="/admin/login"
              className="bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              Get Started
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-border px-6 py-3 rounded-lg hover:bg-accent transition-colors"
            >
              View on GitHub
            </a>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <div className="p-6 border border-border rounded-lg">
            <FileText className="h-10 w-10 text-primary mb-4" />
            <h3 className="mb-2">Markdown Editor</h3>
            <p className="text-muted-foreground">
              Write documentation in Markdown with live preview support
            </p>
          </div>

          <div className="p-6 border border-border rounded-lg">
            <Search className="h-10 w-10 text-primary mb-4" />
            <h3 className="mb-2">Full-text Search</h3>
            <p className="text-muted-foreground">
              Powerful search across all pages with keyboard shortcuts (⌘K)
            </p>
          </div>

          <div className="p-6 border border-border rounded-lg">
            <Moon className="h-10 w-10 text-primary mb-4" />
            <h3 className="mb-2">Dark Mode</h3>
            <p className="text-muted-foreground">
              Automatic dark mode support with theme persistence
            </p>
          </div>

          <div className="p-6 border border-border rounded-lg">
            <Settings className="h-10 w-10 text-primary mb-4" />
            <h3 className="mb-2">Drag & Drop Menu</h3>
            <p className="text-muted-foreground">
              Organize your documentation structure with intuitive drag and drop
            </p>
          </div>

          <div className="p-6 border border-border rounded-lg">
            <Lock className="h-10 w-10 text-primary mb-4" />
            <h3 className="mb-2">Secure Admin</h3>
            <p className="text-muted-foreground">
              Protected admin panel with Supabase authentication
            </p>
          </div>

          <div className="p-6 border border-border rounded-lg">
            <FileText className="h-10 w-10 text-primary mb-4" />
            <h3 className="mb-2">Responsive Design</h3>
            <p className="text-muted-foreground">
              Beautiful on all devices - mobile, tablet, and desktop
            </p>
          </div>
        </div>

        {/* Getting Started */}
        <div className="p-8 border border-border rounded-lg bg-muted/30">
          <h2 className="mb-4">Getting Started</h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                1
              </div>
              <div>
                <h4 className="mb-1">Create Admin Account</h4>
                <p className="text-muted-foreground">
                  Sign up for an admin account at <Link to="/admin/login" className="text-primary underline">/admin/login</Link>
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                2
              </div>
              <div>
                <h4 className="mb-1">Create Your First Page</h4>
                <p className="text-muted-foreground">
                  Use the admin panel to create documentation pages with Markdown content
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                3
              </div>
              <div>
                <h4 className="mb-1">Organize Your Menu</h4>
                <p className="text-muted-foreground">
                  Structure your documentation with drag & drop menu management
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                4
              </div>
              <div>
                <h4 className="mb-1">Share Your Docs</h4>
                <p className="text-muted-foreground">
                  Your documentation is now live and ready to share with the world
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="mt-16 text-center">
          <h3 className="mb-6">Built With Modern Technologies</h3>
          <div className="flex flex-wrap items-center justify-center gap-6 text-muted-foreground">
            <span>React</span>
            <span>•</span>
            <span>TypeScript</span>
            <span>•</span>
            <span>Tailwind CSS</span>
            <span>•</span>
            <span>Supabase</span>
            <span>•</span>
            <span>React Router</span>
            <span>•</span>
            <span>Markdown</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <p>Built with ❤️ using Figma Make</p>
        </div>
      </footer>
    </div>
  );
}
