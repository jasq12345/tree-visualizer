from backend.models.tree import Node, BinaryTree

def bfs_traversal(root_or_tree):
  root = root_or_tree.root if isinstance(root_or_tree, BinaryTree) else root_or_tree
  if not root:
    return []
  result = []
  queue = deque([root])

  while queue:
    node = queue.popleft()
    result.append(node.value)
    if node.lelft:
      queue.append(node.left)
    if node.right:
      queue.append(node.right)
  return result
