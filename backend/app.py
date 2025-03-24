from flask import Flask, jsonify
from flask_cors import CORS
import networkx as nx
import json

app = Flask(__name__)
CORS(app)  # 크로스 오리진 요청 허용

class MultiWOZStateActionSpace:
    def __init__(self):
        # 도메인 정의
        self.domains = ['hotel', 'restaurant', 'train']
        
        # 슬롯 정의
        self.slots = {
            'hotel': ['price', 'type', 'area', 'stars', 'parking'],
            'restaurant': ['price', 'food', 'area', 'name', 'time'],
            'train': ['departure', 'destination', 'day', 'time']
        }
        
        # 대화 행위 정의
        self.dialog_acts = ['greeting', 'request', 'inform', 'recommend', 'book', 'confirm', 'goodbye']
        
        # 상태 공간 생성
        self.states = self._generate_simplified_state_space()
        
        # 행동 공간 생성
        self.actions = self._generate_simplified_action_space()
        
        # 그래프 생성
        self.graph = self._build_state_action_graph()
    
    def _generate_simplified_state_space(self):
        """간소화된 상태 공간 생성"""
        states = []
        
        # 시작 상태
        states.append("start")
        
        # 도메인별 간소화된 상태
        for domain in self.domains:
            # 도메인 선택 상태
            states.append(f"{domain}_selected")
            
            # 슬롯 채우기 단계별 상태 (간소화)
            states.append(f"{domain}_collecting_constraints")
            states.append(f"{domain}_constraints_collected")
            
            # DB 검색 상태
            states.append(f"{domain}_db_search")
            
            # 결과 상태
            states.append(f"{domain}_no_results")
            states.append(f"{domain}_has_results")
            
            # 예약 상태
            states.append(f"{domain}_booking")
            states.append(f"{domain}_booked")
        
        # 다중 도메인 상태
        for domain1 in self.domains:
            for domain2 in self.domains:
                if domain1 != domain2:
                    states.append(f"{domain1}_to_{domain2}_transition")
        
        # 종료 상태
        states.append("end")
        
        return states
    
    def _generate_simplified_action_space(self):
        """간소화된 행동 공간 생성"""
        actions = []
        
        # 일반 행동
        actions.append("greeting")
        actions.append("goodbye")
        
        for domain in self.domains:
            # 도메인별 행동
            for act in ['request', 'inform', 'recommend', 'book', 'confirm']:
                if act == 'request':
                    # 슬롯별 요청 행동
                    for slot in self.slots.get(domain, []):
                        actions.append(f"{domain}-{act}-{slot}")
                elif act == 'inform':
                    # 주요 정보 제공 행동 몇 가지만 포함
                    actions.append(f"{domain}-{act}-name")
                    actions.append(f"{domain}-{act}-price")
                else:
                    # 기타 행동은 도메인 수준으로 간소화
                    actions.append(f"{domain}-{act}")
        
        return actions
    
    def _build_state_action_graph(self):
        """상태-행동 그래프 구축"""
        G = nx.DiGraph()
        
        # 모든 상태를 노드로 추가
        for state in self.states:
            # 도메인 추출
            domain = None
            for d in self.domains:
                if state.startswith(d + "_"):
                    domain = d
                    break
            
            # 노드 색상 설정
            if state == 'start':
                color = 'green'
            elif state == 'end':
                color = 'red'
            elif '_booked' in state:
                color = 'lightgreen'
            elif '_no_results' in state:
                color = 'orange'
            else:
                color = 'lightblue'
            
            G.add_node(state, type='state', color=color, domain=domain)
        
        # 모든 행동을 노드로 추가
        for action in self.actions:
            # 도메인 추출
            domain = None
            for d in self.domains:
                if action.startswith(d + "-"):
                    domain = d
                    break
            
            # 행동 유형 추출
            act_type = None
            if '-' in action:
                act_type = action.split('-')[1]
            
            # 노드 색상 설정
            if 'request' in action:
                color = 'yellow'
            elif 'inform' in action or 'recommend' in action:
                color = 'lightpink'
            elif 'book' in action:
                color = 'purple'
            else:
                color = 'lightgray'
            
            G.add_node(action, type='action', color=color, domain=domain, act_type=act_type)
        
        # 상태-행동-상태 전이 정의
        
        # 시작 -> 인사
        G.add_edge("start", "greeting")
        G.add_edge("greeting", "start")  # 첫 인사 후 다시 시작 상태로
        
        # 도메인 선택
        for domain in self.domains:
            G.add_edge("start", f"{domain}_selected")
            
            # 제약조건 수집
            G.add_edge(f"{domain}_selected", f"{domain}_collecting_constraints")
            
            # 슬롯별 요청 행동
            for slot in self.slots.get(domain, []):
                request_action = f"{domain}-request-{slot}"
                G.add_edge(f"{domain}_collecting_constraints", request_action)
                G.add_edge(request_action, f"{domain}_collecting_constraints")
            
            # 제약조건 수집 완료
            G.add_edge(f"{domain}_collecting_constraints", f"{domain}_constraints_collected")
            
            # DB 검색
            G.add_edge(f"{domain}_constraints_collected", f"{domain}_db_search")
            
            # 검색 결과에 따른 상태
            G.add_edge(f"{domain}_db_search", f"{domain}_no_results")
            G.add_edge(f"{domain}_db_search", f"{domain}_has_results")
            
            # 결과 없음 -> 다시 제약조건 수집
            G.add_edge(f"{domain}_no_results", f"{domain}_collecting_constraints")
            
            # 결과 있음 -> 정보 제공 및 추천
            inform_action = f"{domain}-inform-name"
            recommend_action = f"{domain}-recommend"
            
            G.add_edge(f"{domain}_has_results", inform_action)
            G.add_edge(inform_action, f"{domain}_has_results")
            
            G.add_edge(f"{domain}_has_results", recommend_action)
            G.add_edge(recommend_action, f"{domain}_booking")
            
            # 예약
            book_action = f"{domain}-book"
            G.add_edge(f"{domain}_booking", book_action)
            G.add_edge(book_action, f"{domain}_booked")
            
            # 예약 확인
            confirm_action = f"{domain}-confirm"
            G.add_edge(f"{domain}_booked", confirm_action)
            
            # 예약 후 종료 또는 다른 도메인으로 전환
            G.add_edge(f"{domain}_booked", "end")
            
            # 도메인 간 전환
            for other_domain in self.domains:
                if domain != other_domain:
                    transition_state = f"{domain}_to_{other_domain}_transition"
                    G.add_edge(f"{domain}_booked", transition_state)
                    G.add_edge(transition_state, f"{other_domain}_selected")
        
        # 종료 행동
        G.add_edge("end", "goodbye")
        
        return G
    
    def get_graph_data(self):
        """그래프 데이터를 JSON 형식으로 변환"""
        nodes = []
        for node, attrs in self.graph.nodes(data=True):
            node_data = {
                "id": node,
                "label": node.replace('_', ' '),
                "type": attrs.get('type', 'unknown'),
                "color": attrs.get('color', 'gray'),
                "domain": attrs.get('domain', None)
            }
            nodes.append(node_data)
        
        links = []
        for source, target in self.graph.edges():
            links.append({
                "source": source,
                "target": target
            })
        
        return {
            "nodes": nodes,
            "links": links
        }

# API 엔드포인트 정의
@app.route('/api/graph', methods=['GET'])
def get_graph():
    mdp_space = MultiWOZStateActionSpace()
    graph_data = mdp_space.get_graph_data()
    return jsonify(graph_data)

@app.route('/api/graph/<domain>', methods=['GET'])
def get_domain_graph(domain):
    mdp_space = MultiWOZStateActionSpace()
    graph_data = mdp_space.get_graph_data()
    
    if domain == 'all':
        return jsonify(graph_data)
    
    # 특정 도메인에 속한 노드 필터링
    domain_nodes = [node for node in graph_data["nodes"] 
                   if node["domain"] == domain or 
                   node["id"] in ['start', 'end', 'greeting', 'goodbye']]
    
    domain_node_ids = set(node["id"] for node in domain_nodes)
    
    # 해당하는 링크만 필터링
    domain_links = [link for link in graph_data["links"] 
                   if link["source"] in domain_node_ids and link["target"] in domain_node_ids]
    
    return jsonify({
        "nodes": domain_nodes,
        "links": domain_links
    })

# 웹 서버 시작
if __name__ == '__main__':
    app.run(debug=True)