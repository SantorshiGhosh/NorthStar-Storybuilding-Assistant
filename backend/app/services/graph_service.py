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
            "faction": {
                "bgColor": "#F5F3FF",  # soft purple
                "borderColor": "#8B5CF6",
                "textColor": "#4C1D95",
                "badge": "Faction"
            }
        }

        # Add nodes
        for ent in entities:
            G.add_node(
                ent.id,
                name=ent.name,
                entity_type=ent.entity_type,
                description=ent.description or "",
                traits=ent.traits or [],
                first_appearance=ent.first_appearance_chapter or 1,
                fact_count=len(ent.facts) if hasattr(ent, "facts") and ent.facts else 0
            )

        # Add edges
        for rel in relationships:
            if rel.source_entity_id in G and rel.target_entity_id in G:
                G.add_edge(
                    rel.source_entity_id,
                    rel.target_entity_id,
                    id=rel.id,
                    relation_type=rel.relation_type,
                    description=rel.description or ""
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
                    "description": edata.get("description", "")
                }
            })

        return {"nodes": nodes, "edges": edges}

graph_service = GraphService()
