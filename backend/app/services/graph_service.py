import math
from typing import List, Dict, Any
import networkx as nx

class GraphService:
    @staticmethod
    def build_react_flow_graph(
        entities: List[Any],
        relationships: List[Any]
    ) -> Dict[str, Any]:
        """
        Constructs a NetworkX graph from database records and computes
        layout coordinates formatted specifically for React Flow.
        Includes entity facts and evidence, and edge relationship source quotes.
        """
        G = nx.DiGraph()

        # Type to color/style map for Google Docs / Notion inspired minimalist palette
        type_palette = {
            "character": {
                "bgColor": "#EFF6FF",  # soft blue
                "borderColor": "#3B82F6",
                "textColor": "#1E3A8A",
                "badge": "Character"
            },
            "location": {
                "bgColor": "#ECFDF5",  # soft green
                "borderColor": "#10B981",
                "textColor": "#064E3B",
                "badge": "Location"
            },
            "object": {
                "bgColor": "#FFFBEB",  # soft amber
                "borderColor": "#F59E0B",
                "textColor": "#78350F",
                "badge": "Object"
            },
            "rule": {
                "bgColor": "#FEF2F2",  # soft rose
                "borderColor": "#EF4444",
                "textColor": "#7F1D1D",
                "badge": "World Rule"
            },
            "event": {
                "bgColor": "#FDF4FF",  # soft fuchsia
                "borderColor": "#D946EF",
                "textColor": "#701A75",
                "badge": "Event"
            },
            "faction": {
                "bgColor": "#F5F3FF",  # soft purple
                "borderColor": "#8B5CF6",
                "textColor": "#4C1D95",
                "badge": "Faction"
            }
        }

        # Add nodes
        for ent in entities:
            # Serialize facts with source quotes
            facts_list = []
            if hasattr(ent, "facts") and ent.facts:
                for f in ent.facts:
                    facts_list.append({
                        "id": str(f.id),
                        "fact": f.fact,
                        "category": getattr(f, "category", "general"),
                        "source_chapter_number": getattr(f, "source_chapter_number", None),
                        "source_quote": getattr(f, "source_quote", "")
                    })

            G.add_node(
                str(ent.id),
                name=ent.name,
                entity_type=ent.entity_type,
                description=ent.description or "",
                traits=ent.traits or [],
                first_appearance=getattr(ent, "first_appearance_chapter", 1) or 1,
                facts=facts_list,
                fact_count=len(facts_list)
            )

        # Add edges
        for rel in relationships:
            src_id = str(rel.source_entity_id)
            tgt_id = str(rel.target_entity_id)
            if src_id in G and tgt_id in G:
                G.add_edge(
                    src_id,
                    tgt_id,
                    id=str(rel.id),
                    relation_type=rel.relation_type,
                    description=rel.description or "",
                    source_chapter_id=str(rel.source_chapter_id or ""),
                    source_quote=getattr(rel, "source_quote", "") or ""
                )

        # Calculate coordinates using spring layout or circular
        if len(G.nodes) > 0:
            try:
                # k controls optimal distance between nodes
                pos = nx.spring_layout(G, k=1.8 / math.sqrt(max(1, len(G.nodes))), iterations=50, seed=42)
            except Exception:
                pos = nx.circular_layout(G)
        else:
            pos = {}

        nodes = []
        # Canvas dimensions centered around (450, 300)
        width_span = 750
        height_span = 450
        center_x = 450
        center_y = 300

        for node_id, data in G.nodes(data=True):
            raw_pos = pos.get(node_id, (0, 0))
            x_coord = float(center_x + (raw_pos[0] * width_span / 2))
            y_coord = float(center_y + (raw_pos[1] * height_span / 2))

            ent_type = data.get("entity_type", "character").lower()
            theme = type_palette.get(ent_type, type_palette["character"])

            nodes.append({
                "id": str(node_id),
                "type": "custom",
                "position": {"x": round(x_coord, 1), "y": round(y_coord, 1)},
                "data": {
                    "id": str(node_id),
                    "label": data.get("name", "Unknown"),
                    "name": data.get("name", "Unknown"),
                    "entity_type": ent_type,
                    "description": data.get("description", ""),
                    "traits": data.get("traits", []),
                    "badge": theme["badge"],
                    "bgColor": theme["bgColor"],
                    "borderColor": theme["borderColor"],
                    "textColor": theme["textColor"],
                    "first_appearance": data.get("first_appearance", 1),
                    "facts": data.get("facts", []),
                    "fact_count": data.get("fact_count", 0)
                }
            })

        edges = []
        for u, v, edata in G.edges(data=True):
            edges.append({
                "id": str(edata.get("id", f"{u}-{v}")),
                "source": str(u),
                "target": str(v),
                "label": edata.get("relation_type", "connected to").replace("_", " "),
                "animated": True,
                "data": {
                    "relation_type": edata.get("relation_type", ""),
                    "description": edata.get("description", ""),
                    "source_chapter_id": edata.get("source_chapter_id", ""),
                    "source_quote": edata.get("source_quote", "")
                }
            })

        return {"nodes": nodes, "edges": edges}

graph_service = GraphService()
