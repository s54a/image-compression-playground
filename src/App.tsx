import { ComparisonPreview } from "./components/ComparisonPreview";
import { CompressionControls } from "./components/CompressionControls";
import { PageHeader } from "./components/PageHeader";
import { useImageCompression } from "./hooks/useImageCompression";
import { useTheme } from "./hooks/useTheme";

export default function App() {
  const compression = useImageCompression();
  const { theme, toggleTheme } = useTheme();

  return (
    <main>
      <PageHeader theme={theme} onToggle={toggleTheme} />
      <section className="workspace" aria-label="Image compression">
        <CompressionControls compression={compression} />
        <ComparisonPreview
          key={compression.source?.url ?? "empty"}
          source={compression.source}
          result={compression.result}
          busy={compression.busy}
          reduction={compression.reduction}
        />
      </section>
      <footer>
        <span>Made for a lighter image.</span>
        <span>Processed in your browser. Never uploaded.</span>
      </footer>
    </main>
  );
}
