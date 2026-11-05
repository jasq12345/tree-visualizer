from models.tree import BinaryTree, Node


def dfs_search(
    tree: BinaryTree,
    target: int | None = None,
) -> tuple[list[int], int | None]:
    steps: list[int] = []

    def visit(node: Node | None) -> int | None:
        if node is None:
            return None

        steps.append(node.value)

        if target is not None and node.value == target:
            return node.value

        result = visit(node.left)
        if result is not None:
            return result

        return visit(node.right)

    return steps, visit(tree.root)