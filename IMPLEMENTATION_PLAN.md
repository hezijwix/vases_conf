# Vase Designer - Supabase Integration Implementation Plan

**Date:** 2026-03-19
**Target Platform:** iPad
**Goal:** Transform local export to cloud-based publishing system

---

## 📋 TASK BREAKDOWN

### ✅ Phase 1: UI Restructuring (Local Changes)

#### Task 1.1: Move "Export GLB" Button to Canvas Area
**Location:** Bottom center of canvas, below vase model
**Files to Modify:**
- `index.html` - Move button from toolbar to canvas area
- `styles.css` - Create new button styling for canvas overlay
- `js/ui.js` - Update button placement logic

**Changes:**
- Remove button from toolbar export section
- Create floating button container in canvas area
- Position: `position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%)`
- Ensure button stays above 3D canvas (z-index management)

#### Task 1.2: Update Button Text and Styling
**New Text:** "Publish Your Creation"
**Files to Modify:**
- `js/ui.js` - Update button text
- `styles.css` - Create canvas-specific button style

**Design Specs:**
- Larger, more prominent button
- White background with subtle shadow
- Black text with icon (optional)
- Hover state with scale animation
- Match existing design language

#### Task 1.3: Remove Canvas Rounded Corners
**Files to Modify:**
- `styles.css` - `.tool-canvas-area` class

**Changes:**
- Remove `border-radius: 20px`
- Keep other canvas styling intact

#### Task 1.4: Remove Export PNG Button
**Files to Modify:**
- `js/ui.js` - Remove PNG button creation and event listeners
- `js/engine.js` - Can keep `exportPNG()` function for future use (optional)

**Changes:**
- Remove PNG button DOM creation
- Remove event listener
- Clean up export section layout

---

### 🔧 Phase 2: Supabase Configuration

#### Task 2.1: Supabase Setup Requirements

**Required Information from Supabase Dashboard:**

1. **Project URL**
   - Already provided: `https://qefmwgfnkbfwzxtpwyf.supabase.co`

2. **Anon/Public API Key** ⚠️ NEEDED
   - Location: Project Settings → API → Project API keys → `anon` `public`
   - Used for client-side authentication
   - Safe to use in browser

3. **Service Role Key** (Optional - for admin operations)
   - Location: Project Settings → API → Project API keys → `service_role`
   - Only if server-side operations needed

4. **Storage Bucket Configuration** ⚠️ NEEDED
   - Create a new Storage bucket called: `vase-models`
   - Set bucket to **public** (so files can be viewed/downloaded)
   - Enable RLS (Row Level Security) policies

#### Task 2.2: Database Schema Design

**Table: `vase_creations`**

```sql
CREATE TABLE vase_creations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- Enable RLS
ALTER TABLE vase_creations ENABLE ROW LEVEL SECURITY;

-- Allow public to insert
CREATE POLICY "Allow public insert" ON vase_creations
  FOR INSERT TO anon
  WITH CHECK (true);

-- Allow public to read
CREATE POLICY "Allow public read" ON vase_creations
  FOR SELECT TO anon
  USING (true);
```

**Metadata Structure:**
```json
{
  "vasePreset": "classic",
  "baseColor": "#55bf40",
  "hasHandles": true,
  "timestamp": "2026-03-19T14:30:00Z",
  "device": "iPad"
}
```

#### Task 2.3: Storage Bucket Setup

**Bucket Name:** `vase-models`

**Policies Needed:**

```sql
-- Allow public uploads
CREATE POLICY "Allow public uploads" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'vase-models');

-- Allow public downloads
CREATE POLICY "Allow public downloads" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'vase-models');
```

**File Naming Convention:**
```
{creator_name}_{timestamp}.glb
Example: John_1710859800000.glb
```

---

### 💻 Phase 3: Code Implementation

#### Task 3.1: Install Supabase Client
**Files to Create/Modify:**
- `js/supabase.js` - New file for Supabase configuration
- `index.html` - Add Supabase CDN script

**Implementation:**
```html
<!-- Add to index.html <head> -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

```javascript
// js/supabase.js
const SUPABASE_URL = 'https://qefmwgfnkbfwzxtpwyf.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE'; // ⚠️ TO BE PROVIDED

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

#### Task 3.2: Create Upload Function
**Files to Modify:**
- `js/engine.js` - Create new `publishToSupabase()` function

**Implementation Logic:**
```javascript
export async function publishToSupabase(creatorName, glbBlob) {
  // 1. Generate unique filename
  const timestamp = Date.now();
  const filename = `${creatorName}_${timestamp}.glb`;

  // 2. Upload to Storage
  const { data: storageData, error: storageError } = await supabase.storage
    .from('vase-models')
    .upload(filename, glbBlob, {
      contentType: 'model/gltf-binary',
      cacheControl: '3600'
    });

  // 3. Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('vase-models')
    .getPublicUrl(filename);

  // 4. Save metadata to database
  const { data: dbData, error: dbError } = await supabase
    .from('vase_creations')
    .insert({
      creator_name: creatorName,
      file_path: filename,
      file_url: publicUrl,
      metadata: {
        vasePreset: controls.get('vasePreset'),
        baseColor: controls.get('baseColor'),
        hasHandles: controls.get('showHandles'),
        timestamp: new Date().toISOString(),
        device: 'iPad'
      }
    });

  return { success: true, url: publicUrl };
}
```

#### Task 3.3: Update Modal Functionality
**Files to Modify:**
- `js/ui.js` - Update modal "Send" button handler
- `index.html` - Update modal text (optional)

**Changes:**
- Replace `exportGLB()` call with `publishToSupabase()`
- Add loading state to button ("Publishing...")
- Show success message with shareable link
- Handle errors gracefully

**Success Flow:**
```
1. User clicks "Publish Your Creation"
2. Modal opens
3. User enters name → clicks "Send"
4. Button shows "Publishing..."
5. Upload completes
6. Show success message: "Published! View at: [URL]"
7. Optional: Copy URL to clipboard
```

#### Task 3.4: Error Handling & Loading States
**Files to Modify:**
- `js/ui.js` - Add loading/error UI
- `styles.css` - Add loading spinner styles

**States to Handle:**
- Loading (show spinner)
- Success (show URL, allow copy)
- Error (network issues, Supabase errors)
- Validation (empty name, file too large)

---

### 📱 Phase 4: iPad Optimization

#### Task 4.1: Touch Optimization
**Considerations:**
- Ensure button is large enough for touch (minimum 44x44px)
- Test modal on iPad viewport
- Verify keyboard behavior on input focus

#### Task 4.2: Viewport Configuration
**Files to Modify:**
- `index.html` - Update viewport meta tag

**Ensure:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
```

#### Task 4.3: Network Considerations
**Implementation:**
- Add upload progress indicator
- Handle slow connections gracefully
- Add retry logic for failed uploads

---

## 🔐 SECURITY CHECKLIST

- [ ] Use `anon` key (not `service_role`) in client
- [ ] Enable RLS on all tables
- [ ] Set appropriate storage policies
- [ ] Sanitize creator names before upload
- [ ] Validate file size limits (max 10MB recommended)
- [ ] Add rate limiting (via Supabase policies)

---

## 📊 REQUIRED INFORMATION FROM USER

### ⚠️ BEFORE STARTING IMPLEMENTATION, PLEASE PROVIDE:

1. **Supabase Anon Key**
   - Go to: Supabase Dashboard → Project Settings → API
   - Copy the `anon` `public` key

2. **Confirm Storage Bucket Created**
   - Create bucket named: `vase-models`
   - Make it public
   - Confirm creation

3. **Confirm Database Table Created**
   - Run the SQL from Task 2.2
   - Confirm table exists

---

## 🚀 EXECUTION ORDER

1. ✅ Get Supabase credentials from user
2. ✅ Set up Supabase bucket and table
3. 🔨 Implement UI changes (Phase 1)
4. 🔨 Add Supabase integration (Phase 3)
5. 🧪 Test upload functionality
6. 📱 Test on iPad
7. ✅ Deploy

---

## 📝 TESTING CHECKLIST

- [ ] Button appears in correct position (bottom center of canvas)
- [ ] Button text reads "Publish Your Creation"
- [ ] Canvas has no rounded corners
- [ ] PNG export button is removed
- [ ] Modal opens when publish button clicked
- [ ] File uploads to Supabase successfully
- [ ] Database record created with metadata
- [ ] Public URL is accessible
- [ ] Error states display correctly
- [ ] Works on iPad Safari
- [ ] Touch interactions work smoothly

---

## 🎯 SUCCESS CRITERIA

✅ User can click "Publish Your Creation" button on canvas
✅ Modal captures creator name
✅ GLB file uploads to Supabase Storage
✅ Metadata saved to database
✅ User receives shareable public URL
✅ Works seamlessly on iPad
✅ All UI changes implemented correctly
