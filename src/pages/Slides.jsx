import { celebrate } from "../ui/clickBurst.js";
import { Plus, Presentation } from "lucide-react";
import PageHead from "../ui/PageHead.jsx";
import DataGate from "../components/DataGate.jsx";
import { useWorkspace } from "../workspace/WorkspaceProvider.jsx";
import { selectDecks } from "../workspace/selectors.js";
import DeckGrid from "../slides/DeckGrid.jsx";
import Editor from "../slides/Editor.jsx";

function Inner({ deckId, onOpen, onBack }) {
  const { snap, actions } = useWorkspace();
  if (deckId) return <Editor deckId={deckId} onBack={onBack} />;
  const decks = selectDecks(snap.state);
  const create = (e) => { celebrate(e?.currentTarget); onOpen(actions.createDeck()); };
  return (
    <div className="gallery">
      <PageHead icon={Presentation} title="Presentations" text="Build decks together. Everyone on the team sees edits as they happen.">
        {decks.length > 0 && <button className="btn btn--primary" onClick={create}><Plus size={18} aria-hidden="true" /> New presentation</button>}
      </PageHead>
      <DeckGrid decks={decks} onOpen={onOpen} onCreate={create} />
    </div>
  );
}

export default function Slides(props) {
  return <DataGate><Inner {...props} /></DataGate>;
}
