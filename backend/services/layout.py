from models.responses import Layout, LayoutNode
from models.tree import BinaryTree, Node


def compute_layout(tree: BinaryTree) -> Layout:
    """x = position in in-order, y = depth, so every node gets its own column."""
    nodes: list[LayoutNode] = []
    edges: list[tuple[int, int]] = []

    def visit(node: Node | None, depth: int) -> None:
        if node is None:
            return
        for child in (node.left, node.right):
            if child is not None:
                edges.append((node.value, child.value))
        visit(node.left, depth + 1)
        nodes.append(LayoutNode(value=node.value, x=len(nodes), y=depth))
        visit(node.right, depth + 1)

    visit(tree.root, 0)
    return Layout(nodes=nodes, edges=edges)
