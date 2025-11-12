import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Render } from '@measured/puck';
import '@measured/puck/puck.css';
import { ArrowLeft, Loader2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PuckRenderPage() {
  const { mergeId } = useParams<{ mergeId: string }>();

  const [config, setConfig] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Détecter si on est dans un iframe
  const isInIframe = window.self !== window.top;

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

      // 1. Dynamically import puck.config.tsx
      const puckConfigs = import.meta.glob(
        '../../generated/responsive-screens/*/puck/puck.config.tsx',
        { eager: true }
      );

      // Import CSS
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

      // 2. Load saved Puck data
      const dataRes = await fetch(`/api/responsive-merges/${mergeId}/puck-data`);
      if (dataRes.ok) {
        const savedData = await dataRes.json();
        setData(savedData);
      } else {
        // No saved data yet
        setData({
          content: [],
          root: {},
          zones: {
            'root:header': [],
            'root:body': [],
            'root:footer': []
          }
        });
      }

      setLoading(false);
    } catch (err: any) {
      console.error('Error loading Puck data:', err);
      setError(err.message || 'Failed to load preview');
      setLoading(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Loading Preview</h2>
            <p className="text-muted-foreground">Loading Puck render...</p>
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
            <h2 className="text-2xl font-bold text-destructive">Error Loading Preview</h2>
            <p className="text-muted-foreground">{error}</p>
          </div>
          <Button asChild className="mt-4">
            <Link to={`/responsive-merges/${mergeId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Details
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Puck Render - Si dans iframe, retourne juste le Render sans wrapper
  if (isInIframe) {
    return config && data ? (
      <Render config={config} data={data} />
    ) : (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {!config ? 'Loading configuration...' : 'Loading data...'}
          </p>
        </div>
      </div>
    )
  }

  // Mode standalone (pas dans iframe)
  return (
    <div className="min-h-screen bg-background">
      {/* Header with back and edit buttons */}
      <div className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/responsive-merges/${mergeId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Details
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground font-mono">{mergeId}</span>
            <Button variant="default" size="sm" asChild>
              <Link to={`/responsive-merges/${mergeId}/puck-editor`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Render Puck content */}
      {config && data ? (
        <Render config={config} data={data} />
      ) : (
        <div className="flex items-center justify-center h-screen">
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
