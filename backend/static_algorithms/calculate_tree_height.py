from models.tree import BinaryTree, Node


def calculate_tree_height(
    tree: BinaryTree,
    target: int | None = None,
) -> tuple[list[int], int]:
    steps: list[int] = []

    def visit(node: Node | None) -> int:
        if node is None:
            return 0

        steps.append(node.value)

        left_height = visit(node.left)
        right_height = visit(node.right)

        return 1 + max(left_height, right_height)

    return steps, visit(tree.root)