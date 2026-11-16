package ai.adflow.api.store.creator;

import ai.adflow.api.store.StoreController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/stores/creators")
public class CreatorController extends StoreController<Creator> {

  public CreatorController(CreatorRepository repository) {
    super(repository);
  }
}
