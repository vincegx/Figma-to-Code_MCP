import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Puck } from '@measured/puck';
import '@measured/puck/puck.css';
import { ArrowLeft, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PuckEditorPage() {
  const { mergeId } = useParams<{ mergeId: string }>();
  const navigate = useNavigate();

  const [config, setConfig] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!mergeId) {
      setError('Merge ID is required');
      setLoading(false);
      return;
    }

    loadPuckData();
  }, [mergeId]);

  async function loadPuckData() {
    try {
      setLoading(true);
      setError(null);

      // Set mergeId globally for image URL transformation
      (window as any).__PUCK_MERGE_ID__ = mergeId;

      // 1. Dynamically import puck.config.tsx and CSS files
      const puckConfigs = import.meta.glob(
        '../../generated/responsive-screens/*/puck/puck.config.tsx',
        { eager: true }
      );

      // Import all CSS files (Page.css imports component CSS)
      await import(`../../generated/responsive-screens/${mergeId}/puck/Page.css`);

      // Find the config for this mergeId
      const configPath = `../../generated/responsive-screens/${mergeId}/puck/puck.config.tsx`;
      const configModule = puckConfigs[configPath] as any;

      if (!configModule) {
        throw new Error(`Puck configuration not found for ${mergeId}`);
      }

      const puckConfig = configModule.config;

      if (!puckConfig) {
        throw new Error('Invalid Puck configuration');
      }

      setConfig(puckConfig);

      // 2. Load saved Puck data (or use empty initial data)
      const dataRes = await fetch(`/api/responsive-merges/${mergeId}/puck-data`);
      if (dataRes.ok) {
        const savedData = await dataRes.json();
        console.log('📦 Loaded Puck data:', savedData);

        // Use saved data (should have zones structure)
        if (savedData) {
          console.log('✅ Setting data with zones:', {
            header: savedData.zones?.header?.length || 0,
            body: savedData.zones?.body?.length || 0,
            footer: savedData.zones?.footer?.length || 0
          });
          setData(savedData);
        } else {
          console.log('⚠️ No saved data, using default empty structure');
          // No saved data yet, use default structure with zones
          setData({
            content: [],
            root: {},
            zones: {
              header: [],
              body: [],
              footer: []
            }
          });
        }
      } else {
        console.log('❌ API error, using default empty structure');
        // No saved data yet, use default structure with zones
        setData({
          content: [],
          root: {},
          zones: {
            header: [],
            body: [],
            footer: []
          }
        });
      }

      setLoading(false);
    } catch (err: any) {
      console.error('Error loading Puck data:', err);
      setError(err.message || 'Failed to load editor');
      setLoading(false);
    }
  }

  async function handlePublish(publishedData: any) {
    setSaving(true);
    try {
      const response = await fetch(`/api/responsive-merges/${mergeId}/puck-save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(publishedData)
      });

      if (!response.ok) {
        throw new Error('Failed to save');
      }

      // Update local data
      setData(publishedData);

      // Show success notification
      console.log('✅ Layout saved successfully');
    } catch (err: any) {
      console.error('Error saving:', err);
      alert('❌ Error saving layout: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Loading Puck Editor</h2>
            <p className="text-muted-foreground">Loading components and configuration...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-6xl">⚠️</div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-destructive">Error Loading Editor</h2>
            <p className="text-muted-foreground">{error}</p>
          </div>
          <Button onClick={() => navigate(`/responsive-merges/${mergeId}`)} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Details
          </Button>
        </div>
      </div>
    );
  }

  // Puck Editor
  return (
    <div className="h-screen w-screen overflow-hidden">
      {config && data ? (
        <Puck
          config={config}
          data={data}
          onPublish={handlePublish}
          headerTitle={mergeId}
          overrides={{
            headerActions: () => (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Link
                  to={`/responsive-merges/${mergeId}/puck-preview`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px 12px',
                    backgroundColor: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    textDecoration: 'none',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e5e7eb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                  }}
                >
                  <ExternalLink size={16} />
                  View page
                </Link>
                <Link
                  to={`/responsive-merges/${mergeId}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px 12px',
                    backgroundColor: 'transparent',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#6b7280',
                    textDecoration: 'none',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.color = '#374151';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#6b7280';
                  }}
                >
                  <ArrowLeft size={16} />
                  Back to Details
                </Link>
              </div>
            ),
          }}
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {!config ? 'Loading configuration...' : 'Loading data...'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
