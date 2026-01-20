import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-46c8107b/health", (c) => {
  return c.json({ status: "ok" });
});

// =======================
// AUTH ROUTES
// =======================

// Sign up new admin user
app.post("/make-server-46c8107b/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name: name || email },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.log(`Error creating user during signup: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }

    return c.json({ user: data.user });
  } catch (error) {
    console.log(`Unexpected error during signup: ${error}`);
    return c.json({ error: "Internal server error during signup" }, 500);
  }
});

// =======================
// PAGES ROUTES
// =======================

// Get all pages
app.get("/make-server-46c8107b/pages", async (c) => {
  try {
    const pages = await kv.getByPrefix("page:");
    return c.json({ pages: pages || [] });
  } catch (error) {
    console.log(`Error fetching pages: ${error}`);
    return c.json({ error: "Failed to fetch pages" }, 500);
  }
});

// Get single page by slug (with optional category)
app.get("/make-server-46c8107b/pages/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    const category = c.req.query("category");
    console.log(`GET page request: slug="${slug}", category="${category}"`);
    
    if (category) {
      // If category is specified, look only in that category
      let key = `page:${category}:${slug}`;
      console.log(`Looking for page with key: ${key}`);
      let page = await kv.get(key);
      
      // Special case for 'fyzika': if not found, try 'knihovna-vividbooks'
      if (!page && category === 'fyzika') {
        console.log(`Page not found in fyzika, trying knihovna-vividbooks`);
        key = `page:knihovna-vividbooks:${slug}`;
        page = await kv.get(key);
      }
      
      if (!page) {
        console.log(`Page not found with key: ${key}`);
        return c.json({ error: "Page not found" }, 404);
      }
      
      console.log(`Page found: ${page.title}`);
      return c.json({ page });
    } else {
      // If no category, search all categories
      let categoriesList = (await kv.get("categories") || []).map((c: any) => c.id);
      if (categoriesList.length === 0) {
         categoriesList = ['knihovna-vividbooks', 'vividboard', 'metodika', 'fyzika', 'chemie', 'prirodopis', 'matematika', 'navody'];
      }

      for (const cat of categoriesList) {
        const key = `page:${cat}:${slug}`;
        console.log(`Searching with key: ${key}`);
        const page = await kv.get(key);
        if (page) {
          console.log(`Page found in category ${cat}: ${page.title}`);
          return c.json({ page });
        }
      }
      
      console.log(`Page not found in any category for slug: ${slug}`);
      return c.json({ error: "Page not found" }, 404);
    }
  } catch (error) {
    console.log(`Error fetching page: ${error}`);
    return c.json({ error: "Failed to fetch page" }, 500);
  }
});

// Create or update page (protected) - UPSERT behavior
app.post("/make-server-46c8107b/pages", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (!user?.id || authError) {
      return c.json({ error: "Unauthorized - invalid or missing access token" }, 401);
    }

    const { slug, title, content, description, icon, documentType, type, featuredMedia, sectionImages, parentId, order, category, externalUrl, legacyIds, legacyMetadata, worksheetData } = await c.req.json();
    const categoryKey = category || "knihovna-vividbooks";
    
    if (!slug || !title) {
      return c.json({ error: "Slug and title are required" }, 400);
    }

    const key = `page:${categoryKey}:${slug}`;
    
    // Check if page already exists - if so, update it (UPSERT behavior)
    const existingResult = await kv.get(key);
    const existing = existingResult?.value as Record<string, unknown> | null;
    
    const now = new Date().toISOString();
    const page = {
      id: existing?.id || crypto.randomUUID(),
      slug,
      title,
      content: content || existing?.content || "",
      description: description || existing?.description || "",
      icon: icon || existing?.icon || "",
      documentType: documentType || type || existing?.documentType || "",
      externalUrl: externalUrl || existing?.externalUrl || "",
      featuredMedia: featuredMedia || existing?.featuredMedia || "",
      sectionImages: sectionImages || existing?.sectionImages || [],
      worksheetData: worksheetData !== undefined ? worksheetData : (existing?.worksheetData || null),
      category: categoryKey,
      parentId: parentId !== undefined ? parentId : (existing?.parentId || null),
      order: order !== undefined ? order : (existing?.order || 0),
      legacyIds: legacyIds || existing?.legacyIds || null,
      legacyMetadata: legacyMetadata || existing?.legacyMetadata || null,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    console.log(`${existing ? 'Updating' : 'Creating'} page with key: ${key}, title: ${title}`);
    await kv.set(key, page);

    // Update search index
    await updateSearchIndex();

    console.log(`Page ${existing ? 'updated' : 'created'} successfully: ${key}`);
    return c.json({ page }, existing ? 200 : 201);
  } catch (error) {
    console.log(`Error creating/updating page: ${error}`);
    return c.json({ error: "Failed to create/update page" }, 500);
  }
});

// Update page (protected)
app.put("/make-server-46c8107b/pages/:slug", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (!user?.id || authError) {
      return c.json({ error: "Unauthorized - invalid or missing access token" }, 401);
    }

    const slug = c.req.param("slug");
    const { title, content, description, icon, documentType, featuredMedia, sectionImages, parentId, order, newSlug, category, externalUrl, legacyIds, legacyMetadata, worksheetData } = await c.req.json();
    
    // Find the existing page
    let existing;
    let existingCategory = category;
    
    if (category) {
      existing = await kv.get(`page:${category}:${slug}`);
    } else {
      // Search all categories if not specified
      let categoriesList = (await kv.get("categories") || []).map((c: any) => c.id);
      if (categoriesList.length === 0) {
         categoriesList = ['knihovna-vividbooks', 'vividboard', 'metodika', 'fyzika', 'chemie', 'prirodopis', 'matematika', 'navody'];
      }

      for (const cat of categoriesList) {
        existing = await kv.get(`page:${cat}:${slug}`);
        if (existing) {
          existingCategory = cat;
          break;
        }
      }
    }
    
    if (!existing || !existingCategory) {
      return c.json({ error: "Page not found" }, 404);
    }
    
    const categoryKey = category || existingCategory;
    
    const updatedPage = {
      ...existing,
      title: title !== undefined ? title : existing.title,
      content: content !== undefined ? content : existing.content,
      description: description !== undefined ? description : existing.description,
      icon: icon !== undefined ? icon : existing.icon,
      documentType: documentType !== undefined ? documentType : existing.documentType,
      externalUrl: externalUrl !== undefined ? externalUrl : existing.externalUrl,
      featuredMedia: featuredMedia !== undefined ? featuredMedia : existing.featuredMedia,
      sectionImages: sectionImages !== undefined ? sectionImages : (existing.sectionImages || []),
      worksheetData: worksheetData !== undefined ? worksheetData : (existing.worksheetData || null),
      category: categoryKey,
      parentId: parentId !== undefined ? parentId : existing.parentId,
      order: order !== undefined ? order : existing.order,
      updatedAt: new Date().toISOString(),
    };

    console.log(`Updating page: slug=${slug}, category=${categoryKey}, icon=${icon}, sectionImages=${JSON.stringify(sectionImages)}`);

    // If slug is changing, delete old and create new
    if (newSlug && newSlug !== slug) {
      const newExists = await kv.get(`page:${categoryKey}:${newSlug}`);
      if (newExists) {
        return c.json({ error: "Page with new slug already exists" }, 409);
      }
      
      updatedPage.slug = newSlug;
      console.log(`Changing slug from ${slug} to ${newSlug}`);
      await kv.del(`page:${existingCategory}:${slug}`);
      await kv.set(`page:${categoryKey}:${newSlug}`, updatedPage);
      
      // Update menu structure to reflect slug change
      const menu = await kv.get(`menu:${categoryKey}`) || [];
      const updateMenuSlug = (items: any[]): any[] => {
        return items.map(item => {
          if (item.slug === slug) {
            return {
              ...item,
              slug: newSlug,
              label: updatedPage.title,
              icon: updatedPage.icon
            };
          }
          if (item.children) {
            return {
              ...item,
              children: updateMenuSlug(item.children)
            };
          }
          return item;
        });
      };
      const updatedMenu = updateMenuSlug(menu);
      await kv.set(`menu:${categoryKey}`, updatedMenu);
    } else {
      // If category is changing, delete from old category
      if (categoryKey !== existingCategory) {
        console.log(`Moving page from ${existingCategory} to ${categoryKey}`);
        await kv.del(`page:${existingCategory}:${slug}`);
      }
      await kv.set(`page:${categoryKey}:${slug}`, updatedPage);
    }

    // Update menu structure if icon, title, featuredMedia, documentType or externalUrl changed
    if (icon !== undefined || title !== undefined || featuredMedia !== undefined || documentType !== undefined || externalUrl !== undefined) {
      const menu = await kv.get(`menu:${categoryKey}`) || [];
      const updateMenuAttributes = (items: any[]): any[] => {
        return items.map(item => {
          if (item.slug === updatedPage.slug) {
            return {
              ...item,
              icon: updatedPage.icon,
              label: updatedPage.title,
              // Only update coverImage if featuredMedia has a value (not empty string)
              ...(updatedPage.featuredMedia ? { coverImage: updatedPage.featuredMedia } : {}),
              type: updatedPage.documentType,
              externalUrl: updatedPage.externalUrl
            };
          }
          if (item.children) {
            return {
              ...item,
              children: updateMenuAttributes(item.children)
            };
          }
          return item;
        });
      };
      const updatedMenu = updateMenuAttributes(menu);
      await kv.set(`menu:${categoryKey}`, updatedMenu);
      console.log(`Menu updated with new attributes for page: ${updatedPage.slug}`);
    }

    // Update search index
    await updateSearchIndex();

    console.log(`Page updated successfully: page:${categoryKey}:${updatedPage.slug}`);
    return c.json({ page: updatedPage });
  } catch (error) {
    console.log(`Error updating page: ${error}`);
    return c.json({ error: "Failed to update page" }, 500);
  }
});

// Delete page (protected)
app.delete("/make-server-46c8107b/pages/:slug", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (!user?.id || authError) {
      return c.json({ error: "Unauthorized - invalid or missing access token" }, 401);
    }

    const slug = c.req.param("slug");
    const category = c.req.query("category");
    
    let pageCategory = category;
    let existing;
    
    if (category) {
      existing = await kv.get(`page:${category}:${slug}`);
    } else {
      // Search all categories if not specified
      let categoriesList = (await kv.get("categories") || []).map((c: any) => c.id);
      if (categoriesList.length === 0) {
         categoriesList = ['knihovna-vividbooks', 'vividboard', 'metodika', 'fyzika', 'chemie', 'prirodopis', 'matematika', 'navody'];
      }

      for (const cat of categoriesList) {
        existing = await kv.get(`page:${cat}:${slug}`);
        if (existing) {
          pageCategory = cat;
          break;
        }
      }
    }
    
    if (!existing || !pageCategory) {
      return c.json({ error: "Page not found" }, 404);
    }

    await kv.del(`page:${pageCategory}:${slug}`);

    // Update search index
    await updateSearchIndex();

    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting page: ${error}`);
    return c.json({ error: "Failed to delete page" }, 500);
  }
});

// =======================
// MENU ROUTES
// =======================

// Get menu structure
app.get("/make-server-46c8107b/menu", async (c) => {
  try {
    const category = c.req.query("category") || "knihovna-vividbooks";
    let menu = await kv.get(`menu:${category}`);
    
    // Fallback for 'fyzika': if empty, try 'knihovna-vividbooks'
    if ((!menu || (Array.isArray(menu) && menu.length === 0)) && category === 'fyzika') {
       console.log("Menu empty for fyzika, fetching knihovna-vividbooks fallback");
       menu = await kv.get(`menu:knihovna-vividbooks`);
    }

    return c.json({ menu: menu || [] });
  } catch (error) {
    console.log(`Error fetching menu: ${error}`);
    return c.json({ error: "Failed to fetch menu" }, 500);
  }
});

// Update menu structure (protected)
app.put("/make-server-46c8107b/menu", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (!user?.id || authError) {
      return c.json({ error: "Unauthorized - invalid or missing access token" }, 401);
    }

    const { menu, category } = await c.req.json();
    const categoryKey = category || "knihovna-vividbooks";
    
    if (!Array.isArray(menu)) {
      return c.json({ error: "Menu must be an array" }, 400);
    }

    await kv.set(`menu:${categoryKey}`, menu);

    return c.json({ menu });
  } catch (error) {
    console.log(`Error updating menu: ${error}`);
    return c.json({ error: "Failed to update menu" }, 500);
  }
});

// =======================
// CATEGORY ROUTES
// =======================

// Get categories
app.get("/make-server-46c8107b/categories", async (c) => {
  try {
    const categories = await kv.get("categories");
    
    // Default categories if none exist
    const defaultCategories = [
      { id: 'knihovna-vividbooks', label: 'Knihovna Vividbooks' },
      { id: 'vividboard', label: 'Vividboard' },
      { id: 'metodika', label: 'Metodika' }
    ];
    
    return c.json({ categories: categories || defaultCategories });
  } catch (error) {
    console.log(`Error fetching categories: ${error}`);
    return c.json({ error: "Failed to fetch categories" }, 500);
  }
});

// Update categories (protected)
app.post("/make-server-46c8107b/categories", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (!user?.id || authError) {
      return c.json({ error: "Unauthorized - invalid or missing access token" }, 401);
    }

    const { categories } = await c.req.json();
    
    if (!Array.isArray(categories)) {
      return c.json({ error: "Categories must be an array" }, 400);
    }

    await kv.set("categories", categories);

    return c.json({ categories });
  } catch (error) {
    console.log(`Error updating categories: ${error}`);
    return c.json({ error: "Failed to update categories" }, 500);
  }
});

// =======================
// SEARCH ROUTES
// =======================

// Search pages
app.get("/make-server-46c8107b/search", async (c) => {
  try {
    const query = c.req.query("q")?.toLowerCase() || "";
    
    if (!query) {
      return c.json({ results: [] });
    }

    const pages = await kv.getByPrefix("page:");
    const results = (pages || []).filter((page: any) => {
      const titleMatch = page.title?.toLowerCase().includes(query);
      const contentMatch = page.content?.toLowerCase().includes(query);
      const descMatch = page.description?.toLowerCase().includes(query);
      return titleMatch || contentMatch || descMatch;
    });

    return c.json({ results });
  } catch (error) {
    console.log(`Error searching pages: ${error}`);
    return c.json({ error: "Failed to search" }, 500);
  }
});

// =======================
// HELPER FUNCTIONS
// =======================

async function updateSearchIndex() {
  // This is a placeholder for future search index optimization
  // For now, we do full-text search on demand
  return true;
}

// =======================
// PROFILE & LICENSE ROUTES
// =======================

// Get all schools
app.get("/make-server-46c8107b/schools", async (c) => {
  try {
    const schools = await kv.getByPrefix("school:");
    return c.json({ schools: schools || [] });
  } catch (error) {
    console.log(`Error fetching schools: ${error}`);
    return c.json({ error: "Failed to fetch schools" }, 500);
  }
});

// Get school by code
app.get("/make-server-46c8107b/schools/code/:code", async (c) => {
  try {
    const code = c.req.param("code").toUpperCase();
    const schools = await kv.getByPrefix("school:");
    const school = (schools || []).find((s: any) => s.code?.toUpperCase() === code);
    
    if (!school) {
      return c.json({ error: "School not found" }, 404);
    }
    
    return c.json({ school });
  } catch (error) {
    console.log(`Error fetching school by code: ${error}`);
    return c.json({ error: "Failed to fetch school" }, 500);
  }
});

// Get school by ID
app.get("/make-server-46c8107b/schools/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const school = await kv.get(`school:${id}`);
    
    if (!school) {
      return c.json({ error: "School not found" }, 404);
    }
    
    return c.json({ school });
  } catch (error) {
    console.log(`Error fetching school: ${error}`);
    return c.json({ error: "Failed to fetch school" }, 500);
  }
});

// Create/update school (admin)
app.post("/make-server-46c8107b/schools", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (!user?.id || authError) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { id, code, name, address, city } = await c.req.json();
    
    if (!code || !name) {
      return c.json({ error: "Code and name are required" }, 400);
    }

    const schoolId = id || crypto.randomUUID();
    const school = {
      id: schoolId,
      code: code.toUpperCase(),
      name,
      address: address || "",
      city: city || "",
      createdAt: new Date().toISOString(),
    };

    await kv.set(`school:${schoolId}`, school);
    return c.json({ school }, 201);
  } catch (error) {
    console.log(`Error creating school: ${error}`);
    return c.json({ error: "Failed to create school" }, 500);
  }
});

// Delete school (admin)
app.delete("/make-server-46c8107b/schools/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (!user?.id || authError) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const id = c.req.param("id");
    await kv.del(`school:${id}`);
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting school: ${error}`);
    return c.json({ error: "Failed to delete school" }, 500);
  }
});

// =======================
// USER PROFILE ROUTES
// =======================

// Get current user's profile
app.get("/make-server-46c8107b/profile", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (!user?.id || authError) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const profile = await kv.get(`profile:${user.id}`);
    
    if (!profile) {
      // Return basic profile from auth user if no profile exists
      return c.json({ 
        profile: null,
        authUser: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || user.email
        }
      });
    }
    
    return c.json({ profile });
  } catch (error) {
    console.log(`Error fetching profile: ${error}`);
    return c.json({ error: "Failed to fetch profile" }, 500);
  }
});

// Create/update user profile
app.post("/make-server-46c8107b/profile", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (!user?.id || authError) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { name, role, schoolId, avatarUrl } = await c.req.json();
    
    const existingProfile = await kv.get(`profile:${user.id}`);
    
    const profile = {
      id: existingProfile?.id || crypto.randomUUID(),
      userId: user.id,
      email: user.email,
      name: name || existingProfile?.name || user.user_metadata?.name || user.email,
      role: role || existingProfile?.role || 'teacher',
      schoolId: schoolId !== undefined ? schoolId : existingProfile?.schoolId,
      avatarUrl: avatarUrl !== undefined ? avatarUrl : existingProfile?.avatarUrl,
      createdAt: existingProfile?.createdAt || new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    await kv.set(`profile:${user.id}`, profile);
    return c.json({ profile });
  } catch (error) {
    console.log(`Error updating profile: ${error}`);
    return c.json({ error: "Failed to update profile" }, 500);
  }
});

// Get colleagues from the same school
app.get("/make-server-46c8107b/profile/colleagues", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (!user?.id || authError) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const currentProfile = await kv.get(`profile:${user.id}`);
    if (!currentProfile?.schoolId) {
      return c.json({ colleagues: [] });
    }

    const allProfiles = await kv.getByPrefix("profile:");
    const colleagues = (allProfiles || [])
      .filter((p: any) => p.schoolId === currentProfile.schoolId && p.userId !== user.id)
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        avatarUrl: p.avatarUrl,
        lastActiveAt: p.lastActiveAt,
        role: p.role,
      }));

    return c.json({ colleagues });
  } catch (error) {
    console.log(`Error fetching colleagues: ${error}`);
    return c.json({ error: "Failed to fetch colleagues" }, 500);
  }
});

// =======================
// LICENSE ROUTES
// =======================

// Get license for a school
app.get("/make-server-46c8107b/licenses/:schoolId", async (c) => {
  try {
    const schoolId = c.req.param("schoolId");
    const license = await kv.get(`license:${schoolId}`);
    
    if (!license) {
      // Return empty license with just free features
      return c.json({ 
        license: {
          id: crypto.randomUUID(),
          schoolId,
          subjects: [],
          features: { vividboardWall: true },
          updatedAt: new Date().toISOString()
        }
      });
    }
    
    return c.json({ license });
  } catch (error) {
    console.log(`Error fetching license: ${error}`);
    return c.json({ error: "Failed to fetch license" }, 500);
  }
});

// Get all licenses (admin)
app.get("/make-server-46c8107b/licenses", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (!user?.id || authError) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const licenses = await kv.getByPrefix("license:");
    return c.json({ licenses: licenses || [] });
  } catch (error) {
    console.log(`Error fetching licenses: ${error}`);
    return c.json({ error: "Failed to fetch licenses" }, 500);
  }
});

// Create/update license (admin)
app.post("/make-server-46c8107b/licenses", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (!user?.id || authError) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { schoolId, subjects, features } = await c.req.json();
    
    if (!schoolId) {
      return c.json({ error: "School ID is required" }, 400);
    }

    const existingLicense = await kv.get(`license:${schoolId}`);
    
    const license = {
      id: existingLicense?.id || crypto.randomUUID(),
      schoolId,
      subjects: subjects || existingLicense?.subjects || [],
      features: features || existingLicense?.features || { vividboardWall: true },
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`license:${schoolId}`, license);
    return c.json({ license });
  } catch (error) {
    console.log(`Error updating license: ${error}`);
    return c.json({ error: "Failed to update license" }, 500);
  }
});

// Delete license (admin)
app.delete("/make-server-46c8107b/licenses/:schoolId", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (!user?.id || authError) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const schoolId = c.req.param("schoolId");
    await kv.del(`license:${schoolId}`);
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting license: ${error}`);
    return c.json({ error: "Failed to delete license" }, 500);
  }
});

// Get all profiles (admin) - for managing users
app.get("/make-server-46c8107b/profiles", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (!user?.id || authError) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const profiles = await kv.getByPrefix("profile:");
    return c.json({ profiles: profiles || [] });
  } catch (error) {
    console.log(`Error fetching profiles: ${error}`);
    return c.json({ error: "Failed to fetch profiles" }, 500);
  }
});

// Proxy for VividBoard API (to bypass CORS)
app.get("/make-server-46c8107b/vividboard-proxy/:boardId", async (c) => {
  try {
    const boardId = c.req.param("boardId");
    console.log(`[VividBoard Proxy] Fetching board: ${boardId}`);
    
    const apiUrl = `https://api.vividboard.cz/boards/${boardId}?all=true`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.log(`[VividBoard Proxy] API returned ${response.status}`);
      return c.json({ error: `VividBoard API returned ${response.status}` }, response.status);
    }
    
    const data = await response.json();
    console.log(`[VividBoard Proxy] Successfully fetched board, pages: ${data.content?.pages?.length || 0}`);
    
    return c.json(data);
  } catch (error) {
    console.log(`[VividBoard Proxy] Error: ${error}`);
    return c.json({ error: "Failed to fetch from VividBoard API" }, 500);
  }
});

Deno.serve(app.fetch);