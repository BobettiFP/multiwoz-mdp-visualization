from flask import Flask, jsonify
from flask_cors import CORS
import networkx as nx
import json
import os
from collections import defaultdict, Counter

app = Flask(__name__)
CORS(app)  # 크로스 오리진 요청 허용

class MultiWOZStateActionAnalyzer:
    def __init__(self, data_path):
        self.data_path = data_path
        self.domains = ['hotel', 'restaurant', 'train', 'taxi', 'attraction', 'hospital', 'police']
        
        # 데이터 로드
        self.dialogues = self._load_data()
        
        # 상태 및 행동 추출
        self.states, self.actions, self.transitions = self._analyze_dialogues()
        
        # 그래프 생성
        self.graph = self._build_graph()
    
    def _load_data(self):
        """MultiWOZ 데이터셋 로드"""
        try:
            with open(self.data_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"데이터 로드 오류: {e}")
            return []
    
    def _analyze_dialogues(self):
        """대화에서 상태, 행동, 전이 추출"""
        states = set()
        actions = set()
        transitions = defaultdict(Counter)
        
        # 시작 및 종료 상태 추가
        states.add("start")
        states.add("end")
        
        for dialogue in self.dialogues:
            prev_state = "start"
            
            # 각 대화 턴 분석
            for turn in dialogue.get('turns', []):
                turn_id = turn.get('turn_id')
                speaker = turn.get('speaker')
                utterance = turn.get('utterance')
                
                # 시스템 행동 분석 (시스템 발화인 경우)
                if speaker == 'SYSTEM':
                    if 'dialog_act' in turn:
                        dialog_acts = turn['dialog_act']
                        for domain_act, slot_values in dialog_acts.items():
                            # 도메인-행동 추출 (예: 'Restaurant-Inform')
                            if '-' in domain_act:
                                domain, act = domain_act.split('-', 1)
                                domain = domain.lower()
                                
                                # 도메인이 관심 도메인에 있는 경우만 처리
                                if domain in self.domains:
                                    # 행동 노드 추가
                                    action_id = f"{domain}-{act}"
                                    actions.add(action_id)
                                    
                                    # 전이 추가 (이전 상태 -> 행동)
                                    transitions[prev_state][action_id] += 1
                                    
                                    # 슬롯-값 쌍 처리
                                    for slot_value in slot_values:
                                        slot = slot_value[0]
                                        if slot:
                                            detailed_action = f"{domain}-{act}-{slot}"
                                            actions.add(detailed_action)
                                            transitions[action_id][detailed_action] += 1
                
                # 사용자 상태 분석 (사용자 발화인 경우)
                elif speaker == 'USER':
                    if 'state' in turn:
                        belief_state = turn['state'].get('belief_state', {})
                        active_domains = []
                        
                        # 활성 도메인 추출
                        for domain, slots in belief_state.items():
                            if domain in self.domains and any(slots.values()):
                                active_domains.append(domain)
                                
                                # 도메인 상태 추가
                                domain_state = f"{domain}_active"
                                states.add(domain_state)
                                
                                # 특정 슬롯 상태 추가
                                for slot, value in slots.items():
                                    if value:  # 값이 있는 경우만
                                        slot_state = f"{domain}_{slot}_filled"
                                        states.add(slot_state)
                                        
                                        # 전이 추가 (도메인 상태 -> 슬롯 상태)
                                        transitions[domain_state][slot_state] += 1
                        
                        # 멀티 도메인 상태 처리
                        if len(active_domains) > 1:
                            multi_domain_state = f"multi_domain_{'_'.join(sorted(active_domains))}"
                            states.add(multi_domain_state)
                            
                            # 개별 도메인에서 멀티 도메인으로 전이
                            for domain in active_domains:
                                transitions[f"{domain}_active"][multi_domain_state] += 1
                        
                        # 이전 행동에서 현재 상태로 전이
                        if active_domains:
                            current_state = f"{active_domains[0]}_active" if len(active_domains) == 1 else multi_domain_state
                        else:
                            current_state = "no_active_domain"
                            states.add(current_state)
                        
                        # 행동들에서 현재 상태로 전이 추가
                        for action in actions:
                            if any(transitions[prev_state][action] > 0 for prev_state in states):
                                transitions[action][current_state] += 1
                        
                        prev_state = current_state
            
            # 대화 종료 - 마지막 상태에서 종료 상태로 전이
            transitions[prev_state]["end"] += 1
        
        return states, actions, transitions
    
    def _build_graph(self):
        """상태 및 행동 분석을 기반으로 그래프 구축"""
        G = nx.DiGraph()
        
        # 상태 노드 추가
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
            elif 'booked' in state or 'confirmed' in state:
                color = 'lightgreen'
            elif 'no_results' in state:
                color = 'orange'
            elif 'multi_domain' in state:
                color = 'purple'
            else:
                color = 'lightblue'
            
            G.add_node(state, type='state', color=color, domain=domain)
        
        # 행동 노드 추가
        for action in self.actions:
            # 도메인 및 행동 유형 추출
            domain = None
            act_type = None
            
            if '-' in action:
                parts = action.split('-')
                domain = parts[0]
                act_type = parts[1] if len(parts) > 1 else None
            
            # 노드 색상 설정
            if 'request' in action:
                color = 'yellow'
            elif 'inform' in action or 'recommend' in action:
                color = 'lightpink'
            elif 'book' in action or 'offerbook' in action:
                color = 'purple'
            elif 'nooffer' in action or 'nobook' in action:
                color = 'orange'
            else:
                color = 'lightgray'
            
            G.add_node(action, type='action', color=color, domain=domain, act_type=act_type)
        
        # 전이 추가
        for source, targets in self.transitions.items():
            for target, count in targets.items():
                if count > 0:  # 최소 1번 이상 발생한 전이만 추가
                    G.add_edge(source, target, weight=count)
        
        return G
    
    def get_graph_data(self, domain_filter=None):
        """그래프 데이터를 JSON 형식으로 변환"""
        nodes = []
        for node, attrs in self.graph.nodes(data=True):
            node_data = {
                "id": node,
                "label": node.replace('_', ' ').title(),
                "type": attrs.get('type', 'unknown'),
                "color": attrs.get('color', 'gray'),
                "domain": attrs.get('domain', None)
            }
            
            # 도메인 필터링 적용
            if domain_filter and domain_filter != 'all':
                if attrs.get('domain') != domain_filter and node not in ['start', 'end']:
                    continue
                
                # 멀티 도메인 상태 처리
                if 'multi_domain' in node and domain_filter not in node:
                    continue
            
            nodes.append(node_data)
        
        # 노드 ID 목록 생성 (필터링 후)
        node_ids = set(node["id"] for node in nodes)
        
        links = []
        for source, target, attrs in self.graph.edges(data=True):
            # 필터링된 노드 간의 링크만 포함
            if source in node_ids and target in node_ids:
                links.append({
                    "source": source,
                    "target": target,
                    "weight": attrs.get('weight', 1)
                })
        
        return {
            "nodes": nodes,
            "links": links
        }

# 기존 하드코딩 클래스를 위한 대체 구현 (데이터 로드에 실패할 경우 사용)
class MultiWOZStateActionSpace:
    def __init__(self):
        # 기존 하드코딩 코드...
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
        
        # 상태 및 행동 노드 추가 코드...
        # (기존 코드와 동일)
        
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
        # (기존 코드와 동일)
        
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
    try:
        # 실제 데이터 경로
        data_path = '/Users/hyegang/Desktop/졸업논문/multiwoz/data/MultiWOZ_2.2/train/dialogues_001.json'
        
        # 데이터 존재 확인
        if os.path.exists(data_path):
            analyzer = MultiWOZStateActionAnalyzer(data_path)
            graph_data = analyzer.get_graph_data()
            return jsonify(graph_data)
        else:
            # 데이터 파일이 없으면 하드코딩 버전 사용
            print(f"Warning: Data file not found at {data_path}. Using hardcoded fallback.")
            mdp_space = MultiWOZStateActionSpace()
            graph_data = mdp_space.get_graph_data()
            return jsonify(graph_data)
    except Exception as e:
        print(f"Error in get_graph: {e}")
        # 오류 발생시 하드코딩 버전으로 폴백
        mdp_space = MultiWOZStateActionSpace()
        graph_data = mdp_space.get_graph_data()
        return jsonify(graph_data)

@app.route('/api/graph/<domain>', methods=['GET'])
def get_domain_graph(domain):
    try:
        # 실제 데이터 경로
        data_path = '/Users/hyegang/Desktop/졸업논문/multiwoz/data/MultiWOZ_2.2/train/dialogues_001.json'
        
        if os.path.exists(data_path):
            analyzer = MultiWOZStateActionAnalyzer(data_path)
            graph_data = analyzer.get_graph_data(domain)
            return jsonify(graph_data)
        else:
            # 데이터 파일이 없으면 하드코딩 버전 사용
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
    except Exception as e:
        print(f"Error in get_domain_graph: {e}")
        # 오류 발생시 하드코딩 버전으로 폴백
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