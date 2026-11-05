from models.tree import BinaryTree, Node


def count_nodes_and_leaves(
    tree: BinaryTree,
    target: int | None = None,
) -> tuple[list[int], dict[str, int]]:
    steps: list[int] = []

    def visit(node: Node | None) -> tuple[int, int]:
        if node is None:
            return 0, 0

        steps.append(node.value)

        left_nodes, left_leaves = visit(node.left)
        right_nodes, right_leaves = visit(node.right)

        node_count = 1 + left_nodes + right_nodes

        if node.left is None and node.right is None:
            leaf_count = 1
        else:
            leaf_count = left_leaves + right_leaves

        return node_count, leaf_count

    nodes, leaves = visit(tree.root)

    return steps, {
        "nodes": nodes,
        "leaves": leaves,
    }