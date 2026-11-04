from models.tree import Node


def count_nodes_and_leaves(node: Node | None) -> tuple[int, int]:
    if node is None:
        return 0, 0
    left_nodes, left_leaves = count_nodes_and_leaves(node.left)
    right_nodes, right_leaves = count_nodes_and_leaves(node.right)
    is_leaf = node.left is None and node.right is None
    return 1 + left_nodes + right_nodes, (1 if is_leaf else 0) + left_leaves + right_leaves
