export interface Topic {
  id: string
  title: string
  description: string
  whyItMatters: string
  objectives: string[]
  prerequisites: string[]
  estimatedMinutes: number
  difficulty: number // 1-5
  importance: number // 0-100
  resources: Resource[]
  practiceUrl?: string
}

export interface Resource {
  id: string
  title: string
  url: string
  type: 'video' | 'article' | 'problems'
  source: string // 'youtube' | 'gfg' | 'leetcode' | 'mdn' | 'striver'
  qualityScore: number // 0-100
}

export interface Phase {
  id: string
  title: string
  description: string
  orderIndex: number
  topics: Topic[]
  estimatedHours: number
}

export interface Curriculum {
  id: string
  key: string
  name: string
  description: string
  yearMin: number
  yearMax: number
  phases: Phase[]
  totalTopics: number
  estimatedWeeks: number
}

export const dsaFoundations: Curriculum = {
  id: 'dsa-foundations',
  key: 'dsa-foundations',
  name: 'DSA Foundations',
  description: 'Master Data Structures & Algorithms from scratch. 14 topics, curated resources, prerequisite-aware progression.',
  yearMin: 1,
  yearMax: 2,
  estimatedWeeks: 14,
  totalTopics: 14,
  phases: [
    {
      id: 'phase-1',
      title: 'Foundations',
      description: 'Core concepts every engineer must know',
      orderIndex: 1,
      estimatedHours: 12,
      topics: [
        {
          id: 'complexity-basics',
          title: 'Complexity Basics',
          description: 'Big-O, time & space complexity analysis',
          whyItMatters: 'Every interview starts with "what is the time complexity?"',
          objectives: [
            'Define Big-O, Big-Ω, Big-Θ',
            'Analyze time complexity of loops & recursion',
            'Analyze space complexity including call stack',
            'Compare algorithms using asymptotic notation'
          ],
          prerequisites: [],
          estimatedMinutes: 90,
          difficulty: 1,
          importance: 100,
          resources: [
            { id: 'r1', title: 'Big-O Cheat Sheet', url: 'https://www.bigocheatsheet.com/', type: 'article', source: 'gfg', qualityScore: 90 },
            { id: 'r2', title: 'Time Complexity Analysis', url: 'https://www.youtube.com/watch?v=V42Fbiohc6c', type: 'video', source: 'youtube', qualityScore: 95 },
            { id: 'r3', title: 'Complexity Practice', url: 'https://leetcode.com/tag/algorithm/', type: 'problems', source: 'leetcode', qualityScore: 85 }
          ]
        },
        {
          id: 'arrays',
          title: 'Arrays',
          description: 'Contiguous memory, indexing, common patterns',
          whyItMatters: 'Arrays are the foundation of every data structure',
          objectives: [
            'Understand contiguous memory & cache locality',
            'Master two-pointer & sliding window patterns',
            'Solve prefix sum & difference array problems',
            'Implement dynamic array (ArrayList) from scratch'
          ],
          prerequisites: ['complexity-basics'],
          estimatedMinutes: 120,
          difficulty: 2,
          importance: 100,
          resources: [
            { id: 'r1', title: 'Array Patterns - Striver', url: 'https://takeuforward.org/data-structure/array-data-structure/', type: 'article', source: 'striver', qualityScore: 95 },
            { id: 'r2', title: 'Two Pointers & Sliding Window', url: 'https://www.youtube.com/watch?v=0PSB9UMfGdM', type: 'video', source: 'youtube', qualityScore: 90 },
            { id: 'r3', title: 'Array Problems', url: 'https://leetcode.com/tag/array/', type: 'problems', source: 'leetcode', qualityScore: 85 }
          ]
        },
        {
          id: 'strings',
          title: 'Strings',
          description: 'Character arrays, pattern matching, manipulation',
          whyItMatters: 'String problems appear in every coding interview',
          objectives: [
            'Master string manipulation & character encoding',
            'Implement KMP, Z-algorithm, Rabin-Karp',
            'Solve palindrome, anagram, substring problems',
            'Understand string hashing & rolling hash'
          ],
          prerequisites: ['arrays'],
          estimatedMinutes: 120,
          difficulty: 2,
          importance: 85,
          resources: [
            { id: 'r1', title: 'String Algorithms - GFG', url: 'https://www.geeksforgeeks.org/string-data-structure/', type: 'article', source: 'gfg', qualityScore: 90 },
            { id: 'r2', title: 'KMP & Pattern Matching', url: 'https://www.youtube.com/watch?v=GTJr8OvyEVQ', type: 'video', source: 'youtube', qualityScore: 85 },
            { id: 'r3', title: 'String Problems', url: 'https://leetcode.com/tag/string/', type: 'problems', source: 'leetcode', qualityScore: 80 }
          ]
        },
        {
          id: 'hashing',
          title: 'Hashing',
          description: 'Hash maps, sets, collision resolution, applications',
          whyItMatters: 'O(1) lookup is the superpower behind efficient algorithms',
          objectives: [
            'Understand hash functions & collision resolution',
            'Master HashMap/HashSet usage patterns',
            'Solve frequency counting, pair sum, subarray sum problems',
            'Implement custom hash map with chaining'
          ],
          prerequisites: ['arrays'],
          estimatedMinutes: 120,
          difficulty: 2,
          importance: 100,
          resources: [
            { id: 'r1', title: 'Hashing - Striver', url: 'https://takeuforward.org/data-structure/hashing/', type: 'article', source: 'striver', qualityScore: 95 },
            { id: 'r2', title: 'Hash Map Patterns', url: 'https://www.youtube.com/watch?v=knHrXWzR5gQ', type: 'video', source: 'youtube', qualityScore: 90 },
            { id: 'r3', title: 'Hashing Problems', url: 'https://leetcode.com/tag/hash-table/', type: 'problems', source: 'leetcode', qualityScore: 85 }
          ]
        }
      ]
    },
    {
      id: 'phase-2',
      title: 'Core Patterns',
      description: 'Essential algorithmic patterns for interviews',
      orderIndex: 2,
      estimatedHours: 18,
      topics: [
        {
          id: 'two-pointers',
          title: 'Two Pointers',
          description: 'Opposite ends, same direction, fast-slow pointers',
          whyItMatters: 'Reduces O(n²) to O(n) for sorted arrays',
          objectives: [
            'Master opposite-ends pattern for sorted arrays',
            'Apply same-direction for sliding window',
            'Use fast-slow for cycle detection & middle finding',
            'Solve 3Sum, Container With Most Water, Trapping Rain Water'
          ],
          prerequisites: ['arrays', 'hashing'],
          estimatedMinutes: 90,
          difficulty: 2,
          importance: 90,
          resources: [
            { id: 'r1', title: 'Two Pointers Masterclass', url: 'https://www.youtube.com/watch?v=0PSB9UMfGdM', type: 'video', source: 'youtube', qualityScore: 95 },
            { id: 'r2', title: 'Two Pointers Patterns', url: 'https://takeuforward.org/arrays/two-pointer-technique/', type: 'article', source: 'striver', qualityScore: 90 },
            { id: 'r3', title: 'Two Pointers Problems', url: 'https://leetcode.com/tag/two-pointers/', type: 'problems', source: 'leetcode', qualityScore: 85 }
          ]
        },
        {
          id: 'sliding-window',
          title: 'Sliding Window',
          description: 'Variable/fixed window for subarray/substring problems',
          whyItMatters: 'The go-to pattern for substring & subarray optimization',
          objectives: [
            'Distinguish fixed vs variable window',
            'Master character frequency tracking',
            'Solve minimum window substring, longest substring without repeat',
            'Apply to maximum subarray, minimum size subarray sum'
          ],
          prerequisites: ['two-pointers', 'hashing'],
          estimatedMinutes: 120,
          difficulty: 3,
          importance: 95,
          resources: [
            { id: 'r1', title: 'Sliding Window - GFG', url: 'https://www.geeksforgeeks.org/window-sliding-technique/', type: 'article', source: 'gfg', qualityScore: 85 },
            { id: 'r2', title: 'Sliding Window Patterns', url: 'https://www.youtube.com/watch?v=Mkqh55j04WU', type: 'video', source: 'youtube', qualityScore: 90 },
            { id: 'r3', title: 'Sliding Window Problems', url: 'https://leetcode.com/tag/sliding-window/', type: 'problems', source: 'leetcode', qualityScore: 80 }
          ]
        },
        {
          id: 'binary-search',
          title: 'Binary Search',
          description: 'Monotonic search spaces, lower/upper bound, search on answer',
          whyItMatters: 'Logarithmic search is the hallmark of algorithmic thinking',
          objectives: [
            'Implement iterative & recursive binary search',
            'Master lower_bound & upper_bound patterns',
            'Apply search on answer for optimization problems',
            'Solve Koko Eating Bananas, Capacity To Ship Packages'
          ],
          prerequisites: ['complexity-basics'],
          estimatedMinutes: 120,
          difficulty: 3,
          importance: 100,
          resources: [
            { id: 'r1', title: 'Binary Search - Striver', url: 'https://takeuforward.org/data-structure/binary-search-algorithm/', type: 'article', source: 'striver', qualityScore: 95 },
            { id: 'r2', title: 'Binary Search on Answer', url: 'https://www.youtube.com/watch?v=GU7DpgHINWQ', type: 'video', source: 'youtube', qualityScore: 90 },
            { id: 'r3', title: 'Binary Search Problems', url: 'https://leetcode.com/tag/binary-search/', type: 'problems', source: 'leetcode', qualityScore: 85 }
          ]
        },
        {
          id: 'recursion',
          title: 'Recursion & Backtracking',
          description: 'Call stack, state space tree, pruning, memoization',
          whyItMatters: 'Recursion unlocks trees, graphs, DP, and backtracking',
          objectives: [
            'Trace recursive calls & understand call stack',
            'Master backtracking template (choose, explore, un-choose)',
            'Solve N-Queens, Sudoku, Subsets, Permutations',
            'Apply memoization to optimize overlapping subproblems'
          ],
          prerequisites: ['complexity-basics'],
          estimatedMinutes: 150,
          difficulty: 3,
          importance: 95,
          resources: [
            { id: 'r1', title: 'Recursion & Backtracking - Striver', url: 'https://takeuforward.org/data-structure/recursion-and-backtracking/', type: 'article', source: 'striver', qualityScore: 95 },
            { id: 'r2', title: 'Backtracking Patterns', url: 'https://www.youtube.com/watch?v=LgZ_2Yz1V7c', type: 'video', source: 'youtube', qualityScore: 90 },
            { id: 'r3', title: 'Backtracking Problems', url: 'https://leetcode.com/tag/backtracking/', type: 'problems', source: 'leetcode', qualityScore: 85 }
          ]
        }
      ]
    },
    {
      id: 'phase-3',
      title: 'Data Structures',
      description: 'Linear & non-linear structures with real implementations',
      orderIndex: 3,
      estimatedHours: 20,
      topics: [
        {
          id: 'linked-lists',
          title: 'Linked Lists',
          description: 'Nodes, pointers, fast-slow, reversal, cycle detection',
          whyItMatters: 'Pointer manipulation is tested in every systems interview',
          objectives: [
            'Implement singly/doubly linked list from scratch',
            'Master reversal (iterative & recursive)',
            'Apply fast-slow for middle, cycle detection, palindrome',
            'Solve Merge Two Lists, Add Two Numbers, LRU Cache'
          ],
          prerequisites: ['recursion'],
          estimatedMinutes: 120,
          difficulty: 2,
          importance: 90,
          resources: [
            { id: 'r1', title: 'Linked List - Striver', url: 'https://takeuforward.org/data-structure/linked-list/', type: 'article', source: 'striver', qualityScore: 95 },
            { id: 'r2', title: 'Linked List Patterns', url: 'https://www.youtube.com/watch?v=9VPm6nEbVPA', type: 'video', source: 'youtube', qualityScore: 90 },
            { id: 'r3', title: 'Linked List Problems', url: 'https://leetcode.com/tag/linked-list/', type: 'problems', source: 'leetcode', qualityScore: 85 }
          ]
        },
        {
          id: 'stacks-queues',
          title: 'Stacks & Queues',
          description: 'LIFO/FIFO, monotonic stack, sliding window max',
          whyItMatters: 'Stacks model recursion; queues model BFS & streaming',
          objectives: [
            'Implement stack/queue with array & linked list',
            'Master monotonic stack for next greater element',
            'Apply stack for valid parentheses, histogram area',
            'Use queue for level-order traversal, sliding window max'
          ],
          prerequisites: ['linked-lists'],
          estimatedMinutes: 120,
          difficulty: 2,
          importance: 85,
          resources: [
            { id: 'r1', title: 'Stack & Queue - GFG', url: 'https://www.geeksforgeeks.org/stack-data-structure/', type: 'article', source: 'gfg', qualityScore: 85 },
            { id: 'r2', title: 'Monotonic Stack', url: 'https://www.youtube.com/watch?v=njtHoeSgR1Y', type: 'video', source: 'youtube', qualityScore: 90 },
            { id: 'r3', title: 'Stack Problems', url: 'https://leetcode.com/tag/stack/', type: 'problems', source: 'leetcode', qualityScore: 80 }
          ]
        },
        {
          id: 'trees',
          title: 'Trees',
          description: 'Binary trees, traversals, BST, heap, Trie',
          whyItMatters: 'Hierarchical data is everywhere — file systems, DOM, databases',
          objectives: [
            'Master DFS (pre/in/post-order) & BFS traversals',
            'Understand BST properties & operations',
            'Implement Heap (priority queue) from scratch',
            'Solve LCA, diameter, max path sum, serialize/deserialize'
          ],
          prerequisites: ['linked-lists', 'recursion'],
          estimatedMinutes: 180,
          difficulty: 3,
          importance: 100,
          resources: [
            { id: 'r1', title: 'Tree Data Structure - Striver', url: 'https://takeuforward.org/data-structure/tree-data-structure/', type: 'article', source: 'striver', qualityScore: 95 },
            { id: 'r2', title: 'Tree Traversals', url: 'https://www.youtube.com/watch?v=fAAZixBzIAI', type: 'video', source: 'youtube', qualityScore: 90 },
            { id: 'r3', title: 'Tree Problems', url: 'https://leetcode.com/tag/tree/', type: 'problems', source: 'leetcode', qualityScore: 85 }
          ]
        }
      ]
    },
    {
      id: 'phase-4',
      title: 'Advanced Topics',
      description: 'Graphs, DP, and interview-ready synthesis',
      orderIndex: 4,
      estimatedHours: 22,
      topics: [
        {
          id: 'graphs',
          title: 'Graph Basics',
          description: 'Adjacency list/matrix, BFS/DFS, shortest path, MST',
          whyItMatters: 'Graphs model relationships — social networks, maps, dependencies',
          objectives: [
            'Represent graphs with adjacency list & matrix',
            'Master BFS (shortest path unweighted) & DFS',
            'Implement Dijkstra, Bellman-Ford, Floyd-Warshall',
            'Solve Number of Islands, Clone Graph, Course Schedule'
          ],
          prerequisites: ['trees', 'stacks-queues'],
          estimatedMinutes: 180,
          difficulty: 4,
          importance: 95,
          resources: [
            { id: 'r1', title: 'Graph Algorithms - Striver', url: 'https://takeuforward.org/data-structure/graph-data-structure/', type: 'article', source: 'striver', qualityScore: 95 },
            { id: 'r2', title: 'Graph Patterns', url: 'https://www.youtube.com/watch?v=tWVWeAqZ0WU', type: 'video', source: 'youtube', qualityScore: 90 },
            { id: 'r3', title: 'Graph Problems', url: 'https://leetcode.com/tag/graph/', type: 'problems', source: 'leetcode', qualityScore: 85 }
          ]
        },
        {
          id: 'dp-intro',
          title: 'Dynamic Programming Intro',
          description: 'Memoization, tabulation, state transitions, patterns',
          whyItMatters: 'DP turns exponential problems into polynomial — the ultimate optimization',
          objectives: [
            'Identify optimal substructure & overlapping subproblems',
            'Master top-down (memoization) & bottom-up (tabulation)',
            'Solve 0/1 Knapsack, Coin Change, LIS, Edit Distance',
            'Apply DP on strings, grids, trees, sequences'
          ],
          prerequisites: ['recursion', 'graphs'],
          estimatedMinutes: 240,
          difficulty: 4,
          importance: 100,
          resources: [
            { id: 'r1', title: 'DP - Striver', url: 'https://takeuforward.org/data-structure/dynamic-programming/', type: 'article', source: 'striver', qualityScore: 95 },
            { id: 'r2', title: 'DP Patterns', url: 'https://www.youtube.com/watch?v=oBt53YbR9Kk', type: 'video', source: 'youtube', qualityScore: 90 },
            { id: 'r3', title: 'DP Problems', url: 'https://leetcode.com/tag/dynamic-programming/', type: 'problems', source: 'leetcode', qualityScore: 85 }
          ]
        },
        {
          id: 'mixed-revision',
          title: 'Mixed Revision',
          description: 'Interview-style mixed problems, mock interviews, weak spot targeting',
          whyItMatters: 'Real interviews mix topics — this builds synthesis & speed',
          objectives: [
            'Solve mixed blind-75 style problems under time pressure',
            'Practice explaining approach before coding',
            'Identify & drill personal weak spots',
            'Complete 3 full mock interview sessions'
          ],
          prerequisites: ['dp-intro'],
          estimatedMinutes: 300,
          difficulty: 4,
          importance: 90,
          resources: [
            { id: 'r1', title: 'Blind 75 List', url: 'https://leetcode.com/discuss/general-discussion/460599/blind-75-leetcode-questions', type: 'article', source: 'leetcode', qualityScore: 95 },
            { id: 'r2', title: 'Mock Interview Practice', url: 'https://www.youtube.com/watch?v=YJZCUhxNCv8', type: 'video', source: 'youtube', qualityScore: 85 },
            { id: 'r3', title: 'NeetCode 150', url: 'https://neetcode.io/practice', type: 'problems', source: 'leetcode', qualityScore: 90 }
          ]
        }
      ]
    }
  ]
}

export function getCurriculumByKey(key: string): Curriculum | undefined {
  if (key === 'dsa-foundations') return dsaFoundations
  return undefined
}

export function getTotalTopics(curriculum: Curriculum): number {
  return curriculum.phases.reduce((sum, phase) => sum + phase.topics.length, 0)
}

export function getTotalEstimatedHours(curriculum: Curriculum): number {
  return curriculum.phases.reduce((sum, phase) => sum + phase.estimatedHours, 0)
}