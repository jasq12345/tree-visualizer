from models.tree import BinaryTree, Node


def calculate_subtree_sum(
    tree: BinaryTree,
    target: int | None = None,
) -> tuple[list[int], int]:
    steps: list[int] = []

    def visit(node: Node | None) -> int:
        if node is None:
            return 0

        steps.append(node.value)

        return node.value + visit(node.left) + visit(node.right)

    return steps, visit(tree.root)