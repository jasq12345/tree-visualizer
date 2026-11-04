from models.tree import Node, BinaryTree

def postorder_recursive(root_or_tree, target=None):
    root = root_or_tree.root if isinstance(root_or_tree, BinaryTree) else root_or_tree
    result = []
    def traverse(node):
        if node:
            traverse(node.left)
            traverse(node.right)      
            result.append(node.value)   
    traverse(root)
    return result, None
